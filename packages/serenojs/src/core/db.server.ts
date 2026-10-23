/**
 * SQLite persistence layer.
 *
 * Server-only: this module imports `node:sqlite` and must never be pulled into
 * a client bundle. The schema is derived from `src/schemas`; tables are
 * created lazily on first use and new columns are added automatically.
 *
 * Relations:
 * - `one-to-one`   → stored as an INTEGER column holding the target id.
 * - `one-to-many`  → stored in a join table (the "one" side owns the list).
 * - `many-to-many` → stored in a join table on each side that declares it.
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { emptyValues, getCollections, tableName } from "./schema.js";
import { collectionLocales, isLocalizedField } from "./schema.js";
import { hashPassword } from "../auth/password.server.js";
import type {
  CollectionDef,
  FieldDef,
  FieldValue,
  Item,
  ListResult,
  MediaItem,
} from "./types.js";

import { getCmsConfig } from "../runtime.js";

/** Resolved lazily: the host middleware configures the CMS at boot. */
function dbPath(): string {
  return (
    process.env.ADMIN_DB_PATH ??
    resolve(process.cwd(), getCmsConfig().db.path)
  );
}

type Cache = { db?: DatabaseSync | undefined };
const globalScope = globalThis as typeof globalThis & {
  [key: symbol]: Cache | undefined;
};
const CACHE_KEY = Symbol.for("serenojs.db");
const cache: Cache = (globalScope[CACHE_KEY] ??= {});

function quote(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

function isManyRelation(field: FieldDef): boolean {
  return field.type === "relation" && field.relation?.type !== "one-to-one";
}

/** A physical column: either a base field or one locale of a localized field. */
type StoredColumn = {
  column: string;
  field: FieldDef;
  locale: string | null;
};

/**
 * Every physical column of a collection. Localized fields expand into one
 * column per locale (`name_pt`, `name_en`); the rest keep their field name.
 */
function storedColumns(collection: CollectionDef): StoredColumn[] {
  const columns: StoredColumn[] = [];
  for (const field of collection.fields) {
    if (isManyRelation(field)) continue;
    if (isLocalizedField(collection, field)) {
      for (const locale of collectionLocales(collection)) {
        columns.push({ column: `${field.name}_${locale}`, field, locale });
      }
    } else {
      columns.push({ column: field.name, field, locale: null });
    }
  }
  return columns;
}

/** Join table for a `to-many` relation field. */
function joinTable(collection: CollectionDef, field: FieldDef): string {
  return `r_${tableName(collection.slug)}_${safeName(field.name)}`;
}

function columnType(field: FieldDef): string {
  switch (field.type) {
    case "number":
      return "REAL";
    case "boolean":
      return "INTEGER";
    case "relation":
      return "INTEGER";
    default:
      return "TEXT";
  }
}

/** Auth tables: admin users and their rotating session tokens. */
function migrateAuth(db: DatabaseSync): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS auth_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  );
  db.exec(
    `CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      access_token_hash TEXT NOT NULL,
      refresh_token_hash TEXT NOT NULL,
      access_expires_at TEXT NOT NULL,
      refresh_expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS auth_tokens_user_idx ON auth_tokens (user_id)`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS auth_tokens_access_idx ON auth_tokens (access_token_hash)`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS auth_tokens_refresh_idx ON auth_tokens (refresh_token_hash)`,
  );

  db.exec(
    `CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  );
}

/**
 * Creates the initial admin user the first time the auth tables are used.
 * Override credentials with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
 */
function seedAuth(db: DatabaseSync): void {
  const count = db
    .prepare(`SELECT COUNT(*) AS count FROM auth_users`)
    .get() as { count: number };
  if (Number(count.count) > 0) return;

  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  db.prepare(
    `INSERT INTO auth_users (email, password_hash) VALUES (?, ?)`,
  ).run(email, hashPassword(password));
}

function migrate(db: DatabaseSync): void {
  migrateAuth(db);

  for (const collection of getCollections()) {
    const table = tableName(collection.slug);
    const columns = storedColumns(collection);
    const definition = columns
      .map((entry) => `${quote(entry.column)} ${columnType(entry.field)}`)
      .join(", ");

    db.exec(
      `CREATE TABLE IF NOT EXISTS ${table} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        ${definition ? `, ${definition}` : ""}
      )`,
    );

    const existing = new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
        (row) => row.name,
      ),
    );

    // Legacy single-column data: rename `<field>` to `<field>_<defaultLocale>`
    // so existing values become the default locale. Idempotent.
    const localeCodes = collectionLocales(collection);
    for (const field of collection.fields) {
      if (!isLocalizedField(collection, field)) continue;
      const target = `${field.name}_${localeCodes[0]}`;
      if (existing.has(field.name) && !existing.has(target)) {
        db.exec(
          `ALTER TABLE ${table} RENAME COLUMN ${quote(field.name)} TO ${quote(target)}`,
        );
        existing.delete(field.name);
        existing.add(target);
      }
    }

    for (const entry of columns) {
      if (!existing.has(entry.column)) {
        db.exec(
          `ALTER TABLE ${table} ADD COLUMN ${quote(entry.column)} ${columnType(entry.field)}`,
        );
      }
    }

    for (const field of collection.fields) {
      if (!isManyRelation(field)) continue;
      const join = joinTable(collection, field);
      db.exec(
        `CREATE TABLE IF NOT EXISTS ${join} (
          source_id INTEGER NOT NULL,
          target_id INTEGER NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (source_id, target_id)
        )`,
      );
      db.exec(
        `CREATE INDEX IF NOT EXISTS ${join}_target_idx ON ${join} (target_id)`,
      );
    }
  }
}

export function getDb(): DatabaseSync {
  if (cache.db) return cache.db;
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  migrate(db);
  cache.db = db;
  seedAuth(db);
  return db;
}

function serialize(field: FieldDef, value: FieldValue): string | number | null {
  if (value === null || value === undefined) return null;
  switch (field.type) {
    case "boolean":
      return value ? 1 : 0;
    case "number":
      return Number(value);
    case "relation": {
      const id = Number(value);
      return !Array.isArray(value) && Number.isInteger(id) && id > 0 ? id : null;
    }
    case "media-list": {
      const items = Array.isArray(value) ? value : [];
      const media = items
        .map((entry): MediaItem | null => {
          if (!entry || typeof entry !== "object") return null;
          const record = entry as { url?: unknown; alt?: unknown; primary?: unknown };
          const url = typeof record.url === "string" ? record.url.trim() : "";
          if (!url) return null;
          return {
            url,
            alt: typeof record.alt === "string" ? record.alt : "",
            primary: Boolean(record.primary),
          };
        })
        .filter((entry): entry is MediaItem => entry !== null);
      return media.length > 0 ? JSON.stringify(media) : null;
    }
    case "list": {
      const items = Array.isArray(value) ? value : [];
      const entries = items
        .map((entry) => String(entry).trim())
        .filter(Boolean);
      return entries.length > 0 ? JSON.stringify(entries) : null;
    }
    default:
      return String(value);
  }
}

function parseMediaList(raw: unknown): MediaItem[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry): MediaItem | null => {
        if (!entry || typeof entry !== "object") return null;
        const url = String((entry as { url?: unknown }).url ?? "").trim();
        if (!url) return null;
        const alt = (entry as { alt?: unknown }).alt;
        return {
          url,
          alt: typeof alt === "string" ? alt : "",
          primary: Boolean((entry as { primary?: unknown }).primary),
        };
      })
      .filter((entry): entry is MediaItem => entry !== null);
  } catch {
    return [];
  }
}

function parseStringList(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => String(entry)).filter((entry) => entry !== "");
  } catch {
    return [];
  }
}

/** Decode a single raw column value into a field value. */
function decodeFieldValue(field: FieldDef, raw: unknown): FieldValue {
  switch (field.type) {
    case "boolean":
      return raw === 1 || raw === 1n || raw === true;
    case "number":
      return raw === null || raw === undefined ? null : Number(raw);
    case "relation":
      return isManyRelation(field)
        ? []
        : raw === null || raw === undefined
          ? null
          : Number(raw);
    case "media-list":
      return parseMediaList(raw);
    case "list":
      return parseStringList(raw);
    default:
      return raw === null || raw === undefined ? "" : String(raw);
  }
}

function rowToItem(
  collection: CollectionDef,
  row: Record<string, unknown>,
): Item {
  const item: Record<string, FieldValue | number> = {
    id: Number(row.id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
  for (const field of collection.fields) {
    if (isManyRelation(field)) continue;
    if (isLocalizedField(collection, field)) {
      const value: Record<string, FieldValue> = {};
      for (const locale of collectionLocales(collection)) {
        value[locale] = decodeFieldValue(field, row[`${field.name}_${locale}`]);
      }
      item[field.name] = value;
    } else {
      item[field.name] = decodeFieldValue(field, row[field.name]);
    }
  }
  return item as Item;
}

/** Batch-load `to-many` relation ids for the given items. */
function hydrateManyRelations(
  db: DatabaseSync,
  collection: CollectionDef,
  items: Item[],
): void {
  if (items.length === 0) return;
  const byId = new Map(items.map((item) => [item.id, item]));
  const ids = items.map((item) => item.id);
  const placeholders = ids.map(() => "?").join(", ");

  for (const field of collection.fields) {
    if (!isManyRelation(field)) continue;
    const rows = db
      .prepare(
        `SELECT source_id, target_id FROM ${joinTable(
          collection,
          field,
        )} WHERE source_id IN (${placeholders}) ORDER BY position`,
      )
      .all(...ids) as { source_id: number; target_id: number }[];

    for (const row of rows) {
      const item = byId.get(Number(row.source_id));
      const current = (item?.[field.name] ?? []) as number[];
      current.push(Number(row.target_id));
      if (item) item[field.name] = current;
    }
  }
}

export function listItems(
  collection: CollectionDef,
  {
    page = 1,
    limit = 10,
    q = "",
  }: { page?: number; limit?: number; q?: string } = {},
): ListResult {
  const db = getDb();
  const table = tableName(collection.slug);
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  const params: (string | number)[] = [];

  let where = "";
  const search = q.trim();
  if (search) {
    const searchColumns = storedColumns(collection).filter((entry) =>
      ["text", "email", "textarea", "select", "date"].includes(entry.field.type),
    );
    if (searchColumns.length > 0) {
      where =
        " WHERE " +
        searchColumns.map((entry) => `${quote(entry.column)} LIKE ?`).join(" OR ");
      for (let i = 0; i < searchColumns.length; i += 1) {
        params.push(`%${search}%`);
      }
    }
  }

  const countRow = db
    .prepare(`SELECT COUNT(*) AS count FROM ${table}${where}`)
    .get(...params) as { count: number } | undefined;
  const total = Number(countRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const offset = (safePage - 1) * safeLimit;

  const rows = db
    .prepare(
      `SELECT * FROM ${table}${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, safeLimit, offset) as Record<string, unknown>[];

  const items = rows.map((row) => rowToItem(collection, row));
  hydrateManyRelations(db, collection, items);

  return {
    items,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
  };
}

export function getItem(collection: CollectionDef, id: number): Item | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM ${tableName(collection.slug)} WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const item = rowToItem(collection, row);
  hydrateManyRelations(db, collection, [item]);
  return item;
}

function saveManyRelations(
  db: DatabaseSync,
  collection: CollectionDef,
  id: number,
  values: Record<string, FieldValue>,
): void {
  for (const field of collection.fields) {
    if (!isManyRelation(field)) continue;
    if (!Object.prototype.hasOwnProperty.call(values, field.name)) continue;

    const join = joinTable(collection, field);
    db.prepare(`DELETE FROM ${join} WHERE source_id = ?`).run(id);

    const raw = values[field.name];
    const ids = Array.isArray(raw) ? raw : [];
    const insert = db.prepare(
      `INSERT INTO ${join} (source_id, target_id, position) VALUES (?, ?, ?)`,
    );
    ids.forEach((targetId, position) => {
      insert.run(id, Number(targetId), position);
    });
  }
}

/** Throw-free check that every referenced id actually exists. */
export function checkRelationTargets(
  collection: CollectionDef,
  values: Record<string, FieldValue>,
): Record<string, string> {
  const db = getDb();
  const errors: Record<string, string> = {};

  for (const field of collection.fields) {
    if (field.type !== "relation" || !field.relation) continue;
    if (!Object.prototype.hasOwnProperty.call(values, field.name)) continue;

    const target = getCollections().find(
      (entry) => entry.slug === field.relation?.to,
    );
    if (!target) {
      errors[field.name] = "Coleção de destino inexistente.";
      continue;
    }

    const statement = db.prepare(
      `SELECT 1 AS ok FROM ${tableName(target.slug)} WHERE id = ?`,
    );
    const exists = (id: number) => Boolean(statement.get(id));
    const raw = values[field.name];
    const ids = Array.isArray(raw) ? raw.map(Number) : [Number(raw)];

    if (
      raw !== null &&
      raw !== undefined &&
      ids.some((id) => !Number.isInteger(id) || !exists(id))
    ) {
      errors[field.name] = "Item relacionado inexistente.";
    }
  }

  return errors;
}

/** Read the value destined for a physical column from a nested values map. */
function columnValue(
  column: StoredColumn,
  values: Record<string, FieldValue>,
): FieldValue {
  if (column.locale === null) return values[column.field.name] ?? null;
  const raw = values[column.field.name];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return (raw as Record<string, FieldValue>)[column.locale] ?? null;
}

/** Whether a partial update actually carries this column's value. */
function columnProvided(
  column: StoredColumn,
  values: Record<string, FieldValue>,
): boolean {
  if (!Object.prototype.hasOwnProperty.call(values, column.field.name)) {
    return false;
  }
  if (column.locale === null) return true;
  const raw = values[column.field.name];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  return Object.prototype.hasOwnProperty.call(raw, column.locale);
}

export function createItem(
  collection: CollectionDef,
  values: Record<string, FieldValue>,
): Item {
  const db = getDb();
  const table = tableName(collection.slug);
  const columns = storedColumns(collection);
  const names = columns.map((entry) => quote(entry.column)).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  const params = columns.map((entry) =>
    serialize(entry.field, columnValue(entry, values)),
  );

  const result = db
    .prepare(
      `INSERT INTO ${table} (created_at, updated_at${
        names ? `, ${names}` : ""
      }) VALUES (datetime('now'), datetime('now')${
        placeholders ? `, ${placeholders}` : ""
      })`,
    )
    .run(...params);

  const id = Number(result.lastInsertRowid);
  saveManyRelations(db, collection, id, values);

  const item = getItem(collection, id);
  if (!item) throw new Error("Falha ao ler o item recém-criado.");
  return item;
}

export function updateItem(
  collection: CollectionDef,
  id: number,
  values: Record<string, FieldValue>,
): Item | null {
  const db = getDb();
  const columns = storedColumns(collection).filter((entry) =>
    columnProvided(entry, values),
  );

  if (columns.length > 0) {
    const assignments = columns
      .map((entry) => `${quote(entry.column)} = ?`)
      .join(", ");
    const params = columns.map((entry) =>
      serialize(entry.field, columnValue(entry, values)),
    );
    db.prepare(
      `UPDATE ${tableName(collection.slug)} SET ${assignments}, updated_at = datetime('now') WHERE id = ?`,
    ).run(...params, id);
  }

  saveManyRelations(db, collection, id, values);
  return getItem(collection, id);
}

/** The single row id of a standalone collection, or null when empty. */
function standaloneRowId(
  db: DatabaseSync,
  collection: CollectionDef,
): number | null {
  const row = db
    .prepare(`SELECT id FROM ${tableName(collection.slug)} ORDER BY id LIMIT 1`)
    .get() as { id: number } | undefined;
  return row ? Number(row.id) : null;
}

/**
 * Read the single record of a standalone collection, creating it with its
 * field defaults on first access.
 */
export function getStandalone(collection: CollectionDef): Item {
  const db = getDb();
  const existing = standaloneRowId(db, collection);
  if (existing !== null) {
    const item = getItem(collection, existing);
    if (item) return item;
  }
  return createItem(collection, emptyValues(collection));
}

/**
 * Upsert the single record of a standalone collection. Values are merged over
 * the field defaults so a fresh record is always fully populated.
 */
export function saveStandalone(
  collection: CollectionDef,
  values: Record<string, FieldValue>,
): Item {
  const db = getDb();
  const existing = standaloneRowId(db, collection);
  if (existing === null) {
    return createItem(collection, { ...emptyValues(collection), ...values });
  }
  const item = updateItem(collection, existing, values);
  if (!item) throw new Error("Falha ao atualizar o registro standalone.");
  return item;
}

/** Remove any reference to `targetId` of `target` from every collection. */
function cascadeDeleteReferences(
  db: DatabaseSync,
  target: CollectionDef,
  targetId: number,
): void {
  for (const collection of getCollections()) {
    for (const field of collection.fields) {
      if (field.type !== "relation") continue;
      if (field.relation?.to !== target.slug) continue;

      if (isManyRelation(field)) {
        db.prepare(
          `DELETE FROM ${joinTable(collection, field)} WHERE target_id = ?`,
        ).run(targetId);
      } else {
        db.prepare(
          `UPDATE ${tableName(collection.slug)} SET ${quote(
            field.name,
          )} = NULL WHERE ${quote(field.name)} = ?`,
        ).run(targetId);
      }
    }
  }
}

export function deleteItem(collection: CollectionDef, id: number): boolean {
  const db = getDb();
  const result = db
    .prepare(`DELETE FROM ${tableName(collection.slug)} WHERE id = ?`)
    .run(id);

  for (const field of collection.fields) {
    if (!isManyRelation(field)) continue;
    db.prepare(`DELETE FROM ${joinTable(collection, field)} WHERE source_id = ?`).run(
      id,
    );
  }

  cascadeDeleteReferences(db, collection, id);

  return Number(result.changes) > 0;
}


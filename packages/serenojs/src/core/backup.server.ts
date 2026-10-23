/**
 * Database + uploaded-assets backup and restore.
 *
 * A backup is a single gzip-compressed JSON archive (`<name>.serenojs`) that
 * bundles:
 * - a consistent SQLite snapshot of `.data/admin.db` (via `VACUUM INTO`),
 * - every file under `public/images` (committed assets) and `public/files`
 *   (runtime uploads), stored as base64.
 *
 * The module also runs a lightweight scheduler that drops a fresh backup into
 * `.data/backups` on startup (when overdue) and then every N hours.
 *
 * Server-only: reads/writes the filesystem and talks to the DB layer.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

import { getDb } from "./db.server.js";
import { getCmsConfig } from "../runtime.js";

export const BACKUP_FORMAT = "serenojs-backup";
export const BACKUP_VERSION = 1;
export const BACKUP_EXTENSION = ".serenojs";

export const BACKUP_DIR = resolve(process.cwd(), ".data/backups");
export const PUBLIC_DIR = resolve(process.cwd(), "public");

/** Directories (relative to `public/`) included in a backup. */
const ASSET_DIRS = ["images", "files"] as const;

const SQLITE_MAGIC = "SQLite format 3\u0000";

export class BackupError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.status = status;
  }
}

export type BackupInfo = {
  name: string;
  size: number;
  createdAt: string;
  /** Number of bundled assets, or `null` when unknown (list view). */
  assets: number | null;
};

export type BackupManifest = {
  format: string;
  version: number;
  createdAt: string;
  databaseBytes: number;
  assets: number;
};

type BackupAsset = { path: string; data: string };

type BackupPayload = {
  format: string;
  version: number;
  createdAt: string;
  database: string;
  assets: BackupAsset[];
};

const NAME_RE = /^[a-zA-Z0-9._-]+\.serenojs$/;

function nowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/** Recursively collect files under `dir`, keyed by their path relative to `base`. */
function collectFiles(dir: string, base: string, out: Map<string, string>): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, base, out);
    } else if (entry.isFile()) {
      const rel = relative(base, full).split(sep).join("/");
      out.set(rel, full);
    }
  }
}

/** Consistent snapshot of the live database file. */
function snapshotDatabase(): Buffer {
  const db = getDb();
  const tmp = join(
    tmpdir(),
    `serenojs-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
  );
  try {
    // `VACUUM INTO` writes a transactionally consistent copy, WAL included.
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    return readFileSync(tmp);
  } finally {
    rmSync(tmp, { force: true });
  }
}

/** Build the raw (uncompressed) `.serenojs` payload. */
function buildPayload(): BackupPayload {
  const database = snapshotDatabase();

  const files = new Map<string, string>();
  for (const dir of ASSET_DIRS) {
    collectFiles(join(PUBLIC_DIR, dir), PUBLIC_DIR, files);
  }

  const assets: BackupAsset[] = [];
  for (const [path, full] of files) {
    assets.push({ path, data: readFileSync(full).toString("base64") });
  }
  assets.sort((a, b) => a.path.localeCompare(b.path));

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    database: database.toString("base64"),
    assets,
  };
}

/** Create an in-memory backup archive (gzip). */
export function createBackupBuffer(): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(buildPayload()), "utf8"));
}

/** Create a backup and persist it under `.data/backups`. Returns its metadata. */
export function createBackup(): BackupInfo {
  ensureDir(BACKUP_DIR);
  const name = `backup-${nowStamp()}-${Math.random().toString(16).slice(2, 8)}${BACKUP_EXTENSION}`;
  const buffer = createBackupBuffer();
  const path = join(BACKUP_DIR, name);
  writeFileSync(path, buffer);

  const info = inspectBackup(buffer);
  return { name, size: buffer.length, ...info };}

function inspectBackup(buffer: Buffer): { createdAt: string; assets: number } {
  const payload = parsePayload(buffer);
  return { createdAt: payload.createdAt, assets: payload.assets.length };
}

function parsePayload(buffer: Buffer): BackupPayload {
  let json: unknown;
  try {
    json = JSON.parse(gunzipSync(buffer).toString("utf8"));
  } catch {
    throw new BackupError("Arquivo de backup inválido ou corrompido.");
  }

  const payload = json as Partial<BackupPayload>;
  if (
    payload?.format !== BACKUP_FORMAT ||
    typeof payload.database !== "string" ||
    !Array.isArray(payload.assets)
  ) {
    throw new BackupError("Formato de backup não reconhecido.");
  }
  return payload as BackupPayload;
}

/** List stored backups, newest first. */
export function listBackups(): BackupInfo[] {
  if (!existsSync(BACKUP_DIR)) return [];
  return readdirSync(BACKUP_DIR)
    .filter((name) => NAME_RE.test(name))
    .map((name) => {
      const full = join(BACKUP_DIR, name);
      const stat = statSync(full);
      return {
        name,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        assets: null,
      } satisfies BackupInfo;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function safeBackupPath(name: string): string {
  if (!NAME_RE.test(name)) {
    throw new BackupError("Nome de backup inválido.", 400);
  }
  const full = join(BACKUP_DIR, name);
  if (!full.startsWith(BACKUP_DIR)) {
    throw new BackupError("Nome de backup inválido.", 400);
  }
  if (!existsSync(full)) {
    throw new BackupError("Backup não encontrado.", 404);
  }
  return full;
}

/** Read a stored backup into memory. */
export function readBackup(name: string): { info: BackupInfo; buffer: Buffer } {
  const full = safeBackupPath(name);
  const buffer = readFileSync(full);
  const stat = statSync(full);
  return {
    info: {
      name,
      size: stat.size,
      createdAt: stat.mtime.toISOString(),
      assets: null,
    },
    buffer,
  };
}

/** Delete a stored backup. Returns true when a file was removed. */
export function deleteBackup(name: string): boolean {
  const full = safeBackupPath(name);
  rmSync(full, { force: true });
  return true;
}

/** Keep only the `keep` most recent backups. */
export function pruneBackups(keep: number): number {
  const limit = Math.max(1, Math.floor(keep));
  const list = listBackups();
  let removed = 0;
  for (const backup of list.slice(limit)) {
    rmSync(join(BACKUP_DIR, backup.name), { force: true });
    removed += 1;
  }
  return removed;
}

function writeAsset(path: string, data: Buffer): void {
  const normalized = path.replace(/\\/g, "/");
  if (
    normalized.includes("..") ||
    !ASSET_DIRS.some((dir) => normalized.startsWith(`${dir}/`))
  ) {
    throw new BackupError(`Caminho de arquivo inválido no backup: ${path}`);
  }
  const target = resolve(PUBLIC_DIR, normalized);
  if (!target.startsWith(PUBLIC_DIR + sep)) {
    throw new BackupError(`Caminho de arquivo inválido no backup: ${path}`);
  }
  ensureDir(resolve(target, ".."));
  writeFileSync(target, data);
}

/** Table names present in `main` (excluding SQLite internals). */
function mainTables(db: ReturnType<typeof getDb>): string[] {
  return (
    db
      .prepare(
        `SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
      )
      .all() as { name: string }[]
  ).map((row) => row.name);
}

function tableColumns(
  db: ReturnType<typeof getDb>,
  schema: "main" | "restore",
  table: string,
): string[] {
  return (
    db.prepare(`PRAGMA ${schema}.table_info(${quoteIdent(table)})`).all() as {
      name: string;
    }[]
  ).map((row) => row.name);
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Restore a backup archive.
 *
 * Instead of replacing the SQLite file on disk (which conflicts with the live
 * connection and any duplicated module instances), the uploaded database is
 * attached and its tables are copied into the running database inside a single
 * transaction. Bundled assets are rewritten to `public/`.
 */
export function restoreBackup(buffer: Buffer): BackupManifest {
  const payload = parsePayload(buffer);

  let database: Buffer;
  try {
    database = Buffer.from(payload.database, "base64");
  } catch {
    throw new BackupError("Banco de dados do backup é inválido.");
  }
  if (
    database.length < SQLITE_MAGIC.length ||
    database.subarray(0, SQLITE_MAGIC.length).toString("latin1") !== SQLITE_MAGIC
  ) {
    throw new BackupError("Banco de dados do backup é inválido.");
  }

  const db = getDb();
  const tmp = join(
    tmpdir(),
    `serenojs-restore-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
  );
  writeFileSync(tmp, database);

  try {
    db.exec(`ATTACH DATABASE '${tmp.replace(/'/g, "''")}' AS restore`);
  } catch (error) {
    rmSync(tmp, { force: true });
    throw new BackupError(
      `Não foi possível ler o banco do backup: ${(error as Error).message}`,
    );
  }

  try {
    const restored = new Set(
      (
        db
          .prepare(
            `SELECT name FROM restore.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
          )
          .all() as { name: string }[]
      ).map((row) => row.name),
    );
    const existing = new Set(mainTables(db));

    db.exec("BEGIN");
    try {
      // Wipe tables that are not part of the backup.
      for (const table of existing) {
        if (!restored.has(table)) {
          db.exec(`DELETE FROM main.${quoteIdent(table)}`);
        }
      }
      // Copy every shared table, column by column (intersection).
      for (const table of restored) {
        if (!existing.has(table)) continue;
        const target = tableColumns(db, "main", table);
        const source = new Set(tableColumns(db, "restore", table));
        const columns = target.filter((column) => source.has(column));
        if (columns.length === 0) continue;
        const list = columns.map(quoteIdent).join(", ");
        db.exec(`DELETE FROM main.${quoteIdent(table)}`);
        db.exec(
          `INSERT INTO main.${quoteIdent(table)} (${list}) SELECT ${list} FROM restore.${quoteIdent(table)}`,
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.exec("DETACH DATABASE restore");
    rmSync(tmp, { force: true });
  }

  for (const asset of payload.assets) {
    if (!asset || typeof asset.path !== "string" || typeof asset.data !== "string") {
      continue;
    }
    writeAsset(asset.path, Buffer.from(asset.data, "base64"));
  }

  return {
    format: payload.format,
    version: payload.version,
    createdAt: payload.createdAt,
    databaseBytes: database.length,
    assets: payload.assets.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Scheduled routine                                                          */
/* -------------------------------------------------------------------------- */

function backupDisabled(): boolean {
  return (
    process.env.ADMIN_BACKUP === "false" || !getCmsConfig().backup.enabled
  );
}

function intervalHours(): number {
  return Number(
    process.env.ADMIN_BACKUP_INTERVAL_HOURS ??
      getCmsConfig().backup.intervalHours,
  );
}

function keepCount(): number {
  return Number(process.env.ADMIN_BACKUP_KEEP ?? getCmsConfig().backup.keep);
}

const globalScope = globalThis as typeof globalThis & {
  [key: symbol]: boolean | undefined;
};
const SCHEDULER_KEY = Symbol.for("serenojs.backup-scheduler");

function intervalMs(): number {
  const configured = intervalHours();
  const hours = Number.isFinite(configured) && configured > 0 ? configured : 24;
  return hours * 60 * 60 * 1000;
}

function isDue(): boolean {
  const [latest] = listBackups();
  if (!latest) return true;
  const age = Date.now() - new Date(latest.createdAt).getTime();
  return age >= intervalMs();
}

function runBackup(): void {
  try {
    createBackup();
    const keep = keepCount();
    pruneBackups(Number.isFinite(keep) && keep > 0 ? keep : 10);
  } catch (error) {
    console.error("[backup] falha ao criar backup automático:", error);
  }
}

/**
 * Start the periodic backup routine. Idempotent: safe to call on every request
 * or module load, only the first call schedules anything.
 */
export function startBackupScheduler(): void {
  if (backupDisabled()) return;
  if (globalScope[SCHEDULER_KEY]) return;
  globalScope[SCHEDULER_KEY] = true;

  // Defer the first run so it never blocks the request that triggers startup.
  setTimeout(() => {
    if (isDue()) runBackup();
    const timer = setInterval(runBackup, intervalMs());
    timer.unref?.();
  }, 2_000).unref?.();
}

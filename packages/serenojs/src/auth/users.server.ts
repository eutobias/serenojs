/**
 * User management (admin CRUD over `auth_users`).
 *
 * Passwords are hashed on write and never returned; `UserSummary` is the only
 * shape that leaves the server. Deleting a user also revokes its sessions.
 */
import { getDb } from "../core/db.server.js";
import type { UserSummary } from "./config.js";
import { hashPassword } from "./password.server.js";

export type { UserSummary };

export type MutationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

type UserRow = {
  id: number;
  email: string;
  created_at: string;
  updated_at: string;
};

function toSummary(row: UserRow): UserSummary {
  return {
    id: Number(row.id),
    email: String(row.email),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function listUsers(): UserSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT id, email, created_at, updated_at FROM auth_users ORDER BY id`,
    )
    .all() as UserRow[];
  return rows.map(toSummary);
}

export function getUser(id: number): UserSummary | null {
  const row = getDb()
    .prepare(
      `SELECT id, email, created_at, updated_at FROM auth_users WHERE id = ?`,
    )
    .get(id) as UserRow | undefined;
  return row ? toSummary(row) : null;
}

export function countUsers(): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS count FROM auth_users`)
    .get() as { count: number };
  return Number(row.count);
}

function emailTaken(email: string, exceptId?: number): boolean {
  const row =
    exceptId === undefined
      ? getDb()
          .prepare(`SELECT 1 AS ok FROM auth_users WHERE email = ?`)
          .get(email)
      : getDb()
          .prepare(`SELECT 1 AS ok FROM auth_users WHERE email = ? AND id != ?`)
          .get(email, exceptId);
  return Boolean(row);
}

function asString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

export function createUser(
  input: Record<string, unknown>,
): MutationResult<UserSummary> {
  const email = asString(input.email).toLowerCase();
  const password = String(input.password ?? "");
  const errors: Record<string, string> = {};

  if (!email) errors.email = "Campo obrigatório.";
  else if (!EMAIL_RE.test(email)) errors.email = "E-mail inválido.";
  else if (emailTaken(email)) errors.email = "E-mail já cadastrado.";

  if (!password) errors.password = "Campo obrigatório.";
  else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const db = getDb();
  const result = db
    .prepare(`INSERT INTO auth_users (email, password_hash) VALUES (?, ?)`)
    .run(email, hashPassword(password));

  const user = getUser(Number(result.lastInsertRowid));
  if (!user) throw new Error("Falha ao ler o usuário recém-criado.");
  return { ok: true, value: user };
}

export function updateUser(
  id: number,
  input: Record<string, unknown>,
): MutationResult<UserSummary> | null {
  const existing = getUser(id);
  if (!existing) return null;

  const hasEmail = Object.prototype.hasOwnProperty.call(input, "email");
  const rawPassword = String(input.password ?? "");
  const errors: Record<string, string> = {};

  const email = hasEmail ? asString(input.email).toLowerCase() : existing.email;
  if (hasEmail) {
    if (!email) errors.email = "Campo obrigatório.";
    else if (!EMAIL_RE.test(email)) errors.email = "E-mail inválido.";
    else if (emailTaken(email, id)) errors.email = "E-mail já cadastrado.";
  }

  // Password is optional on update: empty means "keep current".
  if (rawPassword && rawPassword.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const db = getDb();
  if (rawPassword) {
    db.prepare(
      `UPDATE auth_users SET email = ?, password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(email, hashPassword(rawPassword), id);
    // A password change invalidates every existing session.
    db.prepare(`DELETE FROM auth_tokens WHERE user_id = ?`).run(id);
  } else {
    db.prepare(
      `UPDATE auth_users SET email = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(email, id);
  }

  const user = getUser(id);
  if (!user) throw new Error("Falha ao reler o usuário atualizado.");
  return { ok: true, value: user };
}

export type DeleteUserResult = "ok" | "not_found" | "self" | "last";

export function deleteUser(id: number, requesterId: number): DeleteUserResult {
  if (id === requesterId) return "self";
  if (!getUser(id)) return "not_found";
  if (countUsers() <= 1) return "last";

  const db = getDb();
  db.prepare(`DELETE FROM auth_tokens WHERE user_id = ?`).run(id);
  db.prepare(`DELETE FROM auth_users WHERE id = ?`).run(id);
  return "ok";
}

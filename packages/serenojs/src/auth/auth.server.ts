/**
 * Auth core: users and opaque, database-backed session tokens.
 *
 * Design (see AGENTS.md):
 * - Tokens are random 256-bit strings; only their SHA-256 hash is stored.
 * - An access token (30 min) and a refresh token (24 h) are issued together.
 * - Every login or refresh deletes *all* of a user's tokens before issuing a
 *   new pair, so a user effectively has a single active session at a time.
 */
import { createHash, randomBytes } from "node:crypto";

import { getDb } from "../core/db.server.js";
import {
  ACCESS_TTL_MS,
  REFRESH_TTL_MS,
} from "./config.js";
import type { AuthUser } from "./config.js";
import { verifyPassword } from "./password.server.js";

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
};

type UserRow = {
  id: number;
  email: string;
  password_hash: string;
};

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthUser(row: { id: number; email: string }): AuthUser {
  return { id: Number(row.id), email: String(row.email) };
}

function futureIso(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

function isExpired(iso: string): boolean {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) || parsed <= Date.now();
}

/** Run `fn` inside an IMMEDIATE transaction (serializes rotations). */
function withWriteLock<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function findUserByEmail(email: string): UserRow | null {
  const row = getDb()
    .prepare(`SELECT id, email, password_hash FROM auth_users WHERE email = ?`)
    .get(email) as UserRow | undefined;
  return row ?? null;
}

export function verifyCredentials(
  email: string,
  password: string,
): AuthUser | null {
  const row = findUserByEmail(email);
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return toAuthUser(row);
}

/** Replace every token for the user with a fresh access/refresh pair. */
export function createSession(userId: number): SessionTokens {
  return withWriteLock(() => {
    const db = getDb();
    db.prepare(`DELETE FROM auth_tokens WHERE user_id = ?`).run(userId);

    const accessToken = generateToken();
    const refreshToken = generateToken();
    const accessExpiresAt = futureIso(ACCESS_TTL_MS);
    const refreshExpiresAt = futureIso(REFRESH_TTL_MS);

    db.prepare(
      `INSERT INTO auth_tokens (
        user_id, access_token_hash, refresh_token_hash,
        access_expires_at, refresh_expires_at
      ) VALUES (?, ?, ?, ?, ?)`,
    ).run(
      userId,
      hashToken(accessToken),
      hashToken(refreshToken),
      accessExpiresAt,
      refreshExpiresAt,
    );

    return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt };
  });
}

/** Resolve the user for a still-valid access token, or null. */
export function getUserByAccessToken(accessToken: string): AuthUser | null {
  if (!accessToken) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id AS id, u.email AS email, t.access_expires_at AS access_expires_at
       FROM auth_tokens t
       JOIN auth_users u ON u.id = t.user_id
       WHERE t.access_token_hash = ?`,
    )
    .get(hashToken(accessToken)) as
    | { id: number; email: string; access_expires_at: string }
    | undefined;

  if (!row) return null;
  if (isExpired(row.access_expires_at)) return null;
  return toAuthUser(row);
}

/**
 * Validate a refresh token and rotate the session: all of the user's tokens
 * are replaced before the new pair is returned.
 */
export function rotateSession(
  refreshToken: string,
): { user: AuthUser; tokens: SessionTokens } | null {
  if (!refreshToken) return null;
  const hash = hashToken(refreshToken);

  return withWriteLock(() => {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT u.id AS id, u.email AS email, t.refresh_expires_at AS refresh_expires_at
         FROM auth_tokens t
         JOIN auth_users u ON u.id = t.user_id
         WHERE t.refresh_token_hash = ?`,
      )
      .get(hash) as
      | { id: number; email: string; refresh_expires_at: string }
      | undefined;

    if (!row || isExpired(row.refresh_expires_at)) return null;

    const user = toAuthUser(row);
    const userId = user.id;

    db.prepare(`DELETE FROM auth_tokens WHERE user_id = ?`).run(userId);

    const accessToken = generateToken();
    const newRefreshToken = generateToken();
    const accessExpiresAt = futureIso(ACCESS_TTL_MS);
    const refreshExpiresAt = futureIso(REFRESH_TTL_MS);

    db.prepare(
      `INSERT INTO auth_tokens (
        user_id, access_token_hash, refresh_token_hash,
        access_expires_at, refresh_expires_at
      ) VALUES (?, ?, ?, ?, ?)`,
    ).run(
      userId,
      hashToken(accessToken),
      hashToken(newRefreshToken),
      accessExpiresAt,
      refreshExpiresAt,
    );

    return {
      user,
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
        accessExpiresAt,
        refreshExpiresAt,
      },
    };
  });
}

/** Revoke every session of a user (logout from all devices). */
export function revokeUserSessions(userId: number): void {
  getDb().prepare(`DELETE FROM auth_tokens WHERE user_id = ?`).run(userId);
}

/** Revoke the session identified by an access token. */
export function revokeSessionByAccessToken(accessToken: string): void {
  if (!accessToken) return;
  getDb()
    .prepare(`DELETE FROM auth_tokens WHERE access_token_hash = ?`)
    .run(hashToken(accessToken));
}

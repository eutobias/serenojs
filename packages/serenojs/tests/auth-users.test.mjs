import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "serenojs-auth-"));
process.env.ADMIN_DB_PATH = join(dir, "test.db");
process.env.ADMIN_EMAIL = "admin@test.local";
process.env.ADMIN_PASSWORD = "test-password";
process.env.ADMIN_BACKUP = "false";

const { configureCms } = await import("../dist/runtime.js");
const { createCmsApp } = await import("../dist/server/app.js");
const { getDb } = await import("../dist/core/db.server.js");

const posts = {
  slug: "posts",
  label: "Posts",
  access: { read: "public", create: "private", update: "private", delete: "private" },
  fields: [{ name: "title", label: "Title", type: "text", required: true, localized: false }],
};

configureCms({
  collections: [posts],
  defaultLocale: "pt",
  api: { path: "/api" },
  auth: { path: "/auth" },
  db: { path: process.env.ADMIN_DB_PATH },
  backup: { enabled: false },
  admin: { enabled: false },
});

const app = createCmsApp();
const request = (path, init) => app.request(`http://localhost${path}`, init);

function json(body, cookie) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  };
}

function cookiePairs(response) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => value.split(";")[0]);
}

function cookiesFrom(response) {
  return cookiePairs(response).join("; ");
}

function tokenValue(cookie, name) {
  const prefix = `${name}=`;
  const part = cookie.split(";").find((entry) => entry.trim().startsWith(prefix));
  return part ? part.trim().slice(prefix.length) : "";
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

let cookie = "";
let secondUserId = 0;

before(async () => {
  const login = await request(
    "/auth/login",
    json({ email: "admin@test.local", password: "test-password" }),
  );
  assert.equal(login.status, 200);
  cookie = cookiesFrom(login);
});

after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore open SQLite handles.
  }
});

test("rejects invalid credentials and cross-origin unsafe requests", async () => {
  const invalid = await request(
    "/auth/login",
    json({ email: "admin@test.local", password: "wrong-password" }),
  );
  assert.equal(invalid.status, 401);

  const crossOrigin = await request("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example",
      host: "localhost",
    },
    body: JSON.stringify({ email: "admin@test.local", password: "test-password" }),
  });
  assert.equal(crossOrigin.status, 403);
});

test("refresh rotates the session and invalidates the previous cookies", async () => {
  const refreshed = await request("/auth/refresh", {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(refreshed.status, 200);
  const nextCookie = cookiesFrom(refreshed);
  assert.match(nextCookie, /serenojs_access=/);
  assert.match(nextCookie, /serenojs_refresh=/);
  assert.notEqual(nextCookie, cookie);

  assert.equal((await request("/auth/me", { headers: { cookie } })).status, 401);
  assert.equal((await request("/auth/me", { headers: { cookie: nextCookie } })).status, 200);
  cookie = nextCookie;
});

test("transparently rotates an expired access token using the refresh token", async () => {
  const access = tokenValue(cookie, "serenojs_access");
  assert.ok(access);
  const db = getDb();
  db.prepare(
    `UPDATE auth_tokens SET access_expires_at = ? WHERE access_token_hash = ?`,
  ).run("2000-01-01T00:00:00.000Z", hashToken(access));

  const me = await request("/auth/me", { headers: { cookie } });
  assert.equal(me.status, 200);
  const rotated = cookiesFrom(me);
  assert.match(rotated, /serenojs_access=/);
  assert.notEqual(tokenValue(rotated, "serenojs_access"), access);
  cookie = rotated;
});

test("supports user CRUD and validation", async () => {
  const list = await request("/auth/users", { headers: { cookie } });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).users.length, 1);

  const shortPassword = await request(
    "/auth/users",
    json({ email: "second@test.local", password: "short" }, cookie),
  );
  assert.equal(shortPassword.status, 422);
  assert.match((await shortPassword.json()).errors.password, /8 caracteres/);

  const created = await request(
    "/auth/users",
    json({ email: "second@test.local", password: "second-pass" }, cookie),
  );
  assert.equal(created.status, 201);
  secondUserId = (await created.json()).user.id;

  const duplicate = await request(
    "/auth/users",
    json({ email: "second@test.local", password: "second-pass" }, cookie),
  );
  assert.equal(duplicate.status, 422);
  assert.equal((await duplicate.json()).errors.email, "E-mail já cadastrado.");

  const read = await request(`/auth/users/${secondUserId}`, { headers: { cookie } });
  assert.equal(read.status, 200);
  assert.equal((await read.json()).user.email, "second@test.local");

  const updated = await request(`/auth/users/${secondUserId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ email: "renamed@test.local" }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).user.email, "renamed@test.local");

  const weakUpdate = await request(`/auth/users/${secondUserId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ password: "123" }),
  });
  assert.equal(weakUpdate.status, 422);

  const deleted = await request(`/auth/users/${secondUserId}`, {
    method: "DELETE",
    headers: { cookie },
  });
  assert.equal(deleted.status, 200);
  assert.equal(
    (await request(`/auth/users/${secondUserId}`, { headers: { cookie } })).status,
    404,
  );
});

test("prevents deleting the current user and supports logout", async () => {
  const me = await request("/auth/me", { headers: { cookie } });
  const user = (await me.json()).user;

  const self = await request(`/auth/users/${user.id}`, {
    method: "DELETE",
    headers: { cookie },
  });
  assert.equal(self.status, 409);

  const loggedOut = await request("/auth/logout", {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(loggedOut.status, 200);
  assert.equal((await request("/auth/me", { headers: { cookie } })).status, 401);
});

test("rejects cross-origin writes to private collections", async () => {
  const login = await request(
    "/auth/login",
    json({ email: "admin@test.local", password: "test-password" }),
  );
  const freshCookie = cookiesFrom(login);
  const response = await request("/api/posts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: freshCookie,
      origin: "https://evil.example",
      host: "localhost",
    },
    body: JSON.stringify({ title: "Nope" }),
  });
  assert.equal(response.status, 403);
});

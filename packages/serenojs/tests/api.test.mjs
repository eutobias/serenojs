import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "serenojs-test-"));
process.env.ADMIN_DB_PATH = join(dir, "test.db");
process.env.ADMIN_EMAIL = "admin@test.local";
process.env.ADMIN_PASSWORD = "test-password";
process.env.ADMIN_BACKUP = "false";

const { configureCms } = await import("../dist/runtime.js");
const { createCmsApp } = await import("../dist/server/app.js");
const { BACKUP_FORMAT, BACKUP_EXTENSION } = await import("../dist/core/backup.server.js");

const authors = {
  slug: "authors",
  label: "Authors",
  access: { read: "public", create: "private", update: "private", delete: "private" },
  fields: [{ name: "name", label: "Name", type: "text", required: true, localized: false }],
};

const posts = {
  slug: "posts",
  label: "Posts",
  locales: ["pt", "en"],
  access: { read: "public", create: "private", update: "private", delete: "private" },
  fields: [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "slug", label: "Slug", type: "text", required: true, localized: false },
    { name: "active", label: "Active", type: "boolean", defaultValue: false },
    { name: "author", label: "Author", type: "relation", relation: { to: "authors", type: "one-to-one" } },
  ],
};

const settings = {
  slug: "settings",
  label: "Settings",
  standalone: true,
  access: { read: "private", update: "private" },
  fields: [{ name: "siteName", label: "Site name", type: "text", localized: false }],
};

configureCms({
  title: "SerenoJS Test",
  collections: [posts, authors, settings],
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

function cookiesFrom(response) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => value.split(";")[0]).join("; ");
}

let cookie = "";
let authorId = 0;
let postId = 0;

before(async () => {
  const seeded = await request("/api/posts");
  assert.equal(seeded.status, 200);

  const login = await request(
    "/auth/login",
    json({ email: "admin@test.local", password: "test-password" }),
  );
  assert.equal(login.status, 200);
  cookie = cookiesFrom(login);
  assert.match(cookie, /serenojs_access=/);
  assert.match(cookie, /serenojs_refresh=/);

  const author = await request(
    "/api/authors",
    json({ name: "Ada Lovelace" }, cookie),
  );
  assert.equal(author.status, 201);
  authorId = (await author.json()).item.id;
});

after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // The SQLite handle may still be open; the OS cleans temp files up.
  }
});

test("public reads are allowed and private writes require auth", async () => {
  const list = await request("/api/posts");
  assert.equal(list.status, 200);
  assert.deepEqual(await list.json(), {
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  const denied = await request("/api/posts", json({}));
  assert.equal(denied.status, 401);
});

test("validates payloads and returns localized field errors", async () => {
  const response = await request("/api/posts", json({}, cookie));
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.message, "Dados inválidos.");
  assert.equal(body.errors.title_pt, "Campo obrigatório.");
  assert.equal(body.errors.title_en, "Campo obrigatório.");
  assert.equal(body.errors.slug, "Campo obrigatório.");
});

test("creates, reads, updates and deletes a post", async () => {
  const created = await request(
    "/api/posts",
    json(
      {
        title: { pt: "Olá", en: "Hello" },
        slug: "hello",
        active: true,
        author: authorId,
      },
      cookie,
    ),
  );
  assert.equal(created.status, 201);
  const item = (await created.json()).item;
  postId = item.id;
  assert.deepEqual(item.title, { pt: "Olá", en: "Hello" });
  assert.equal(item.slug, "hello");
  assert.equal(item.active, true);
  assert.equal(item.author, authorId);

  const fetched = await request(`/api/posts/${postId}`);
  assert.equal(fetched.status, 200);
  assert.equal((await fetched.json()).item.slug, "hello");

  const updated = await request(
    `/api/posts/${postId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ active: false, title: { en: "Updated" } }),
    },
  );
  assert.equal(updated.status, 200);
  const updatedItem = (await updated.json()).item;
  assert.equal(updatedItem.active, false);
  assert.deepEqual(updatedItem.title, { pt: "Olá", en: "Updated" });

  const list = await request("/api/posts");
  assert.equal(list.status, 200);
  assert.equal((await list.json()).total, 1);

  const relations = await request("/api/posts/relations", { headers: { cookie } });
  assert.equal(relations.status, 200);
  const options = (await relations.json()).options;
  assert.deepEqual(options.author, [{ id: authorId, label: "Ada Lovelace" }]);

  const deleted = await request(`/api/posts/${postId}`, { method: "DELETE", headers: { cookie } });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { ok: true });

  const gone = await request(`/api/posts/${postId}`);
  assert.equal(gone.status, 404);
});

test("handles standalone collections", async () => {
  const denied = await request("/api/settings");
  assert.equal(denied.status, 401);

  const read = await request("/api/settings", { headers: { cookie } });
  assert.equal(read.status, 200);
  assert.equal((await read.json()).item.siteName, "");

  const updated = await request(
    "/api/settings",
    {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ siteName: "SerenoJS" }),
    },
  );
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).item.siteName, "SerenoJS");

  const rejected = await request("/api/settings", json({}, cookie));
  assert.equal(rejected.status, 405);
});

test("returns 404 for unknown collections", async () => {
  const response = await request("/api/unknown");
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: "Coleção não encontrada." });
});

test("uses the SerenoJS backup format", () => {
  assert.equal(BACKUP_FORMAT, "serenojs-backup");
  assert.equal(BACKUP_EXTENSION, ".serenojs");
});

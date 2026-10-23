import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const originalCwd = process.cwd();
const dir = mkdtempSync(join(tmpdir(), "serenojs-media-"));
const publicDir = join(dir, "public");
mkdirSync(join(publicDir, "files"), { recursive: true });
mkdirSync(join(publicDir, "images"), { recursive: true });
writeFileSync(join(publicDir, "images", "logo.txt"), "logo-asset");
process.chdir(dir);
process.env.ADMIN_DB_PATH = join(dir, "test.db");
process.env.ADMIN_EMAIL = "admin@test.local";
process.env.ADMIN_PASSWORD = "test-password";
process.env.ADMIN_BACKUP = "false";

const { configureCms } = await import("../dist/runtime.js");
const { createCmsApp } = await import("../dist/server/app.js");
const {
  UPLOADS_DIR,
  deleteByUrl,
  readUpload,
  resolveUploadPath,
} = await import("../dist/core/media.server.js");

const posts = {
  slug: "posts",
  label: "Posts",
  access: { read: "public", create: "private", update: "private", delete: "private" },
  fields: [
    { name: "title", label: "Title", type: "text", required: true, localized: false },
    {
      name: "cover",
      label: "Cover",
      type: "media",
      accept: ["image/png"],
      maxSize: 8,
    },
  ],
};

configureCms({
  title: "SerenoJS Test",
  collections: [posts],
  defaultLocale: "pt",
  api: { path: "/api" },
  auth: { path: "/auth" },
  db: { path: process.env.ADMIN_DB_PATH },
  backup: { enabled: false, path: "/backup" },
  admin: { enabled: false },
});

const app = createCmsApp();
const request = (path, init) => app.request(`http://localhost${path}`, init);

function json(body, cookie, method = "POST") {
  return {
    method,
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

function fileForm(name, bytes, type) {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], name, { type }));
  return form;
}

let cookie = "";
let postId = 0;
let mediaUrl = "";
let backupName = "";
let backupBuffer = Buffer.alloc(0);

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
    process.chdir(originalCwd);
  } catch {
    // Ignore.
  }
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // The SQLite handle may still be open.
  }
});

test("media upload requires authentication", async () => {
  const response = await request(
    "/media?collection=posts&field=cover",
    { method: "POST", body: fileForm("cover.png", [1, 2, 3], "image/png") },
  );
  assert.equal(response.status, 401);
});

test("uploads, serves and deletes a valid media file", async () => {
  const response = await request(
    "/media?collection=posts&field=cover",
    {
      method: "POST",
      headers: { cookie },
      body: fileForm("cover.png", [1, 2, 3, 4], "image/png"),
    },
  );
  assert.equal(response.status, 201);
  const media = (await response.json()).media;
  mediaUrl = media.url;
  assert.match(media.url, /^\/files\//);
  assert.equal(media.size, 4);
  assert.equal(media.type, "image/png");
  assert.equal(readFileSync(join(UPLOADS_DIR, media.name)).length, 4);

  const served = await request(media.url);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/png");
  assert.equal(served.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(new Uint8Array(await served.arrayBuffer()), new Uint8Array([1, 2, 3, 4]));

  const deleted = await request(`/media?url=${encodeURIComponent(mediaUrl)}`, {
    method: "DELETE",
    headers: { cookie },
  });
  assert.equal(deleted.status, 200);
  assert.equal(readUpload(media.name), null);
  assert.equal((await request(mediaUrl)).status, 404);
});

test("rejects blocked, oversized and unknown media", async () => {
  const html = await request(
    "/media?collection=posts&field=cover",
    {
      method: "POST",
      headers: { cookie },
      body: fileForm("evil.html", [1], "text/html"),
    },
  );
  assert.equal(html.status, 422);

  const big = await request(
    "/media?collection=posts&field=cover",
    {
      method: "POST",
      headers: { cookie },
      body: fileForm("big.png", [1, 2, 3, 4, 5, 6, 7, 8, 9], "image/png"),
    },
  );
  assert.equal(big.status, 413);

  const wrongType = await request(
    "/media?collection=posts&field=cover",
    {
      method: "POST",
      headers: { cookie },
      body: fileForm("cover.gif", [1], "image/gif"),
    },
  );
  assert.equal(wrongType.status, 422);

  const unknown = await request(
    "/media?collection=posts&field=missing",
    { method: "POST", headers: { cookie }, body: fileForm("cover.png", [1], "image/png") },
  );
  assert.equal(unknown.status, 400);
});

test("media path helpers reject traversal and non-upload URLs", () => {
  assert.equal(resolveUploadPath("../test.db"), null);
  assert.equal(resolveUploadPath(".hidden"), null);
  assert.equal(readUpload("missing.png"), null);
  assert.equal(deleteByUrl("/images/logo.txt"), false);
  assert.equal(deleteByUrl("/files/../test.db"), false);
});

test("creates, lists, downloads, restores and deletes backups", async () => {
  const createdPost = await request(
    "/api/posts",
    json({ title: "Before backup" }, cookie),
  );
  assert.equal(createdPost.status, 201);
  postId = (await createdPost.json()).item.id;

  const created = await request("/backup", { method: "POST", headers: { cookie } });
  assert.equal(created.status, 201);
  const info = (await created.json()).backup;
  backupName = info.name;
  assert.match(backupName, /\.serenojs$/);
  assert.ok(info.assets >= 1);

  const list = await request("/backup", { headers: { cookie } });
  assert.equal(list.status, 200);
  assert.ok((await list.json()).backups.some((entry) => entry.name === backupName));

  const downloaded = await request(
    `/backup?name=${encodeURIComponent(backupName)}`,
    { headers: { cookie } },
  );
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get("content-type"), "application/gzip");
  backupBuffer = Buffer.from(await downloaded.arrayBuffer());
  assert.ok(backupBuffer.length > 0);

  const latest = await request("/backup?latest=1", { headers: { cookie } });
  assert.equal(latest.status, 200);
  assert.match(latest.headers.get("content-disposition"), /attachment; filename="backup-.*\.serenojs"/);

  // Remove the live data and asset, then restore both from the archive.
  const removed = await request(`/api/posts/${postId}`, {
    method: "DELETE",
    headers: { cookie },
  });
  assert.equal(removed.status, 200);
  assert.equal((await request(`/api/posts/${postId}`)).status, 404);
  unlinkSync(join(publicDir, "images", "logo.txt"));

  const restored = await request("/backup", {
    method: "PUT",
    headers: { cookie, "content-type": "application/gzip" },
    body: backupBuffer,
  });
  assert.equal(restored.status, 200);
  const manifest = (await restored.json()).manifest;
  assert.equal(manifest.format, "serenojs-backup");
  assert.ok(manifest.assets >= 1);
  assert.equal((await request(`/api/posts/${postId}`)).status, 200);
  assert.equal(readFileSync(join(publicDir, "images", "logo.txt"), "utf8"), "logo-asset");

  const deleted = await request(`/backup?name=${encodeURIComponent(backupName)}`, {
    method: "DELETE",
    headers: { cookie },
  });
  assert.equal(deleted.status, 200);
  const empty = await request("/backup", { headers: { cookie } });
  assert.equal((await empty.json()).backups.length, 0);
});

test("rejects invalid backup requests", async () => {
  const traversal = await request("/backup?name=../test.db", { headers: { cookie } });
  assert.equal(traversal.status, 400);

  const missing = await request("/backup?name=missing.serenojs", { headers: { cookie } });
  assert.equal(missing.status, 404);

  const invalid = await request("/backup", {
    method: "PUT",
    headers: { cookie, "content-type": "application/gzip" },
    body: Buffer.from("not-a-backup"),
  });
  assert.equal(invalid.status, 422);

  const empty = await request("/backup", {
    method: "PUT",
    headers: { cookie, "content-type": "application/gzip" },
    body: Buffer.alloc(0),
  });
  assert.equal(empty.status, 400);
});

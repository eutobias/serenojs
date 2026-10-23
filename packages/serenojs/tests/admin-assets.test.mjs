import test, { after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const adminIndex = new URL("../admin-dist/index.html", import.meta.url);
const hasAdminBundle = existsSync(adminIndex);

const dir = mkdtempSync(join(tmpdir(), "serenojs-admin-"));
process.env.ADMIN_DB_PATH = join(dir, "test.db");
process.env.ADMIN_BACKUP = "false";

const { configureCms } = await import("../dist/runtime.js");
const { createCmsApp } = await import("../dist/server/app.js");

if (!hasAdminBundle) {
  test("admin asset tests require admin-dist", { skip: "run pnpm build:admin first" }, () => {});
}

function baseConfig(admin) {
  return {
    title: "SerenoJS Admin",
    collections: [],
    defaultLocale: "pt",
    admin,
    api: { path: "/api" },
    auth: { path: "/auth" },
    db: { path: process.env.ADMIN_DB_PATH },
    backup: { enabled: false },
  };
}

after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore open SQLite handles.
  }
});

test("serves the admin shell and assets at the configured path", { skip: !hasAdminBundle }, async () => {
  configureCms(baseConfig({ path: "/panel", enabled: true, noindex: true }));
  const app = createCmsApp();

  const shell = await app.request("http://localhost/panel");
  assert.equal(shell.status, 200);
  assert.match(shell.headers.get("content-type"), /text\/html/);
  assert.equal(shell.headers.get("x-robots-tag"), "noindex, nofollow");
  const html = await shell.text();
  assert.match(html, /<title>SerenoJS Admin<\/title>/);
  assert.match(html, /window\.__SERENOJS__ = \{/);
  assert.match(html, /"title":"SerenoJS Admin"/);

  const history = await app.request("http://localhost/panel/posts/1");
  assert.equal(history.status, 200);

  const index = await app.request("http://localhost/_serenojs/admin/index.html");
  assert.equal(index.status, 200);
  assert.match(index.headers.get("content-type"), /text\/html/);

  const missing = await app.request("http://localhost/_serenojs/admin/missing.js");
  assert.equal(missing.status, 404);

  const oldPath = await app.request("http://localhost/admin");
  assert.equal(oldPath.status, 404);
});

test("can disable the admin and its assets", { skip: !hasAdminBundle }, async () => {
  configureCms(baseConfig({ path: "/panel", enabled: false, noindex: true }));
  const app = createCmsApp();

  assert.equal((await app.request("http://localhost/panel")).status, 404);
  assert.equal(
    (await app.request("http://localhost/_serenojs/admin/index.html")).status,
    404,
  );
});

test("omits the robots header when noindex is disabled", { skip: !hasAdminBundle }, async () => {
  configureCms(baseConfig({ path: "/panel", enabled: true, noindex: false }));
  const app = createCmsApp();

  const shell = await app.request("http://localhost/panel");
  assert.equal(shell.status, 200);
  assert.equal(shell.headers.get("x-robots-tag"), null);
});

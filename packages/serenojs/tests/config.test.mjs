import test from "node:test";
import assert from "node:assert/strict";

import { resolveCmsConfig } from "../dist/config.js";

test("applies the documented defaults", () => {
  const config = resolveCmsConfig({ collections: [] });

  assert.equal(config.title, "SerenoJS");
  assert.equal(config.defaultLocale, "pt");
  assert.deepEqual(config.locales, [
    { code: "pt", label: "Português" },
    { code: "en", label: "English" },
  ]);
  assert.deepEqual(config.admin, { path: "/admin", enabled: true, noindex: true });
  assert.equal(config.api.path, "/api");
  assert.equal(config.auth.path, "/auth");
  assert.equal(config.media.path, "/media");
  assert.equal(config.files.path, "/files");
  assert.equal(config.backup.path, "/backup");
  assert.equal(config.backup.enabled, true);
  assert.equal(config.backup.intervalHours, 24);
  assert.equal(config.backup.keep, 10);
  assert.equal(config.db.path, ".data/admin.db");
});

test("normalizes mount paths", () => {
  const config = resolveCmsConfig({
    collections: [],
    admin: { path: "painel/" },
    api: { path: "/content/" },
    auth: { path: "auth" },
    media: { path: "/" },
    files: { path: "/assets/" },
    backup: { path: "backups/" },
  });

  assert.equal(config.admin.path, "/painel");
  assert.equal(config.api.path, "/content");
  assert.equal(config.auth.path, "/auth");
  assert.equal(config.media.path, "/");
  assert.equal(config.files.path, "/assets");
  assert.equal(config.backup.path, "/backups");
});

test("honors explicit switches and overrides", () => {
  const config = resolveCmsConfig({
    title: "Custom",
    collections: [],
    locales: [{ code: "es", label: "Español" }],
    defaultLocale: "es",
    admin: { enabled: false, noindex: false },
    backup: { enabled: false, intervalHours: 6, keep: 3 },
    db: { path: "/tmp/custom.db" },
  });

  assert.equal(config.title, "Custom");
  assert.equal(config.defaultLocale, "es");
  assert.deepEqual(config.locales, [{ code: "es", label: "Español" }]);
  assert.equal(config.admin.enabled, false);
  assert.equal(config.admin.noindex, false);
  assert.equal(config.backup.enabled, false);
  assert.equal(config.backup.intervalHours, 6);
  assert.equal(config.backup.keep, 3);
  assert.equal(config.db.path, "/tmp/custom.db");
});

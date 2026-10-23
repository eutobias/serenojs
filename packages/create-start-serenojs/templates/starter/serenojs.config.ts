import { defineCmsConfig } from "@eutobias/serenojs/config";

import { collections } from "./src/schemas";
import { defaultLocale, locales } from "./src/schemas/locales";

/**
 * Host-side configuration. The admin SPA, REST API and auth endpoints are
 * mounted by `src/middleware/serenojs.ts` at the paths below.
 */
export default defineCmsConfig({
  title: "SerenoJS",
  collections,
  locales,
  defaultLocale,
  admin: {
    // Change this to hide the panel at a custom path (e.g. "/painel").
    path: process.env.ADMIN_PATH ?? "/admin",
    enabled: process.env.ADMIN_ENABLED !== "false",
    noindex: true,
  },
  api: { path: process.env.ADMIN_API_PATH ?? "/api" },
  auth: { path: process.env.ADMIN_AUTH_PATH ?? "/auth" },
  media: { path: "/media" },
  files: { path: "/files" },
  backup: {
    path: "/backup",
    enabled: process.env.ADMIN_BACKUP !== "false",
    intervalHours: Number(process.env.ADMIN_BACKUP_INTERVAL_HOURS ?? "24"),
    keep: Number(process.env.ADMIN_BACKUP_KEEP ?? "10"),
  },
  db: { path: process.env.ADMIN_DB_PATH ?? ".data/admin.db" },
});

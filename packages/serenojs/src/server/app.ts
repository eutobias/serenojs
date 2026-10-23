/**
 * The whole server surface of the CMS, mounted as a single Hono middleware.
 *
 * `createCmsMiddleware(config)` returns the factory Waku expects from
 * `src/middleware/*.ts`. Requests that belong to the CMS (admin SPA, REST API,
 * auth, media, uploads and backups) are answered here; everything else falls
 * through to the host's Waku pages.
 */
import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname } from "node:path";

import { Hono, type Context, type MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { getCollection } from "../core/schema.js";
import { getCmsConfig } from "../runtime.js";
import type { CmsConfig, CollectionDef } from "../config.js";
import { configureCms } from "../runtime.js";

import {
  checkRelationTargets,
  createItem,
  deleteItem,
  getItem,
  getStandalone,
  listItems,
  saveStandalone,
  updateItem,
} from "../core/db.server.js";
import { coerceInput } from "../core/validation.js";
import { itemLabel } from "../core/schema.js";
import { contentTypeFor, readUpload } from "../core/media.server.js";
import { MediaError, deleteByUrl, saveUpload } from "../core/media.server.js";
import {
  BackupError,
  createBackup,
  createBackupBuffer,
  deleteBackup,
  listBackups,
  readBackup,
  restoreBackup,
  startBackupScheduler,
} from "../core/backup.server.js";

import { createSession, getUserByAccessToken, revokeUserSessions, rotateSession, verifyCredentials } from "../auth/auth.server.js";
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  COOKIE_SECURE,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  isSafeMethod,
} from "../auth/config.js";
import type { AuthUser, UserSummary } from "../auth/config.js";
import { readBody } from "../auth/http.server.js";
import { createUser, deleteUser, getUser, listUsers, updateUser } from "../auth/users.server.js";

const ADMIN_ASSETS_PREFIX = "/_serenojs/admin";
/**
 * Locate the package's built admin bundle. In development the CMS source is
 * bundled into the host's `dist/server`, so `import.meta.url` no longer points
 * at the package. Resolve through the host's `node_modules` first and fall
 * back to the source-relative path.
 */
function adminDist(): string {
  try {
    const req = createRequire(resolve(process.cwd(), "package.json"));
    return join(dirname(req.resolve("@eutobias/serenojs/package.json")), "admin-dist");
  } catch {
    return fileURLToPath(new URL("../../admin-dist/", import.meta.url));
  }
}

type Env = { Variables: { user: AuthUser } };

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  txt: "text/plain; charset=utf-8",
};

function mimeFor(path: string): string {
  return MIME[extname(path).slice(1).toLowerCase()] ?? "application/octet-stream";
}

function isUnsafe(req: { method: string; header: (name: string) => string | undefined }): boolean {
  return !isSafeMethod(req.method);
}

function methodKey(method: string): "read" | "create" | "update" | "delete" {
  const m = method.toUpperCase();
  if (m === "POST") return "create";
  if (m === "PATCH" || m === "PUT") return "update";
  if (m === "DELETE") return "delete";
  return "read";
}

const ACCESS_DEFAULTS: Record<"read" | "create" | "update" | "delete", "public" | "private"> = {
  read: "public",
  create: "private",
  update: "private",
  delete: "private",
};

function accessFor(collection: CollectionDef | undefined, method: string): "public" | "private" {
  const key = methodKey(method);
  return (collection?.access?.[key] ?? ACCESS_DEFAULTS[key]) === "public"
    ? "public"
    : "private";
}

function jsonError(message: string, status: number): Response {
  return Response.json({ message }, { status });
}

/* -------------------------------------------------------------------------- */
/* Auth helpers                                                               */
/* -------------------------------------------------------------------------- */

function setAuthCookies(c: Context<Env>, tokens: { accessToken: string; refreshToken: string }): void {
  setCookie(c, ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: COOKIE_SECURE,
    maxAge: ACCESS_TTL_SECONDS,
  });
  setCookie(c, REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: COOKIE_SECURE,
    maxAge: REFRESH_TTL_SECONDS,
  });
}

function clearAuthCookies(c: Context<Env>): void {
  deleteCookie(c, ACCESS_COOKIE, { path: "/" });
  deleteCookie(c, REFRESH_COOKIE, { path: "/" });
}

function currentUser(c: Context<Env>): AuthUser | null {
  const token = getCookie(c, ACCESS_COOKIE);
  return token ? getUserByAccessToken(token) : null;
}

/** Require a valid access token, transparently rotating a valid refresh. */
const requireAuth: MiddlewareHandler<Env> = async (c, next) => {
  if (isUnsafe(c.req) && isCrossOrigin(c)) {
    return jsonError("Origem não permitida.", 403);
  }

  const user = currentUser(c);
  if (user) {
    c.set("user", user);
    return next();
  }

  const refresh = getCookie(c, REFRESH_COOKIE);
  const rotated = refresh ? rotateSession(refresh) : null;
  if (rotated) {
    setAuthCookies(c, rotated.tokens);
    c.set("user", rotated.user);
    return next();
  }

  return jsonError("Não autenticado.", 401);
};

function isCrossOrigin(c: Context<Env>): boolean {
  const origin = c.req.header("origin");
  if (!origin) return false;
  const host = c.req.header("host");
  if (!host) return true;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/* -------------------------------------------------------------------------- */
/* REST API                                                                   */
/* -------------------------------------------------------------------------- */

function collectionName(c: Context<Env>): string {
  const param = c.req.param("collection");
  if (param) return String(param);
  // Middleware (`use`) does not always expose route params; derive the slug
  // from the mounted path instead.
  const base = getCmsConfig().api.path;
  const rest = c.req.path.startsWith(`${base}/`)
    ? c.req.path.slice(base.length + 1)
    : c.req.path;
  return rest.split("/")[0] ?? "";
}

const cms = new Hono<Env>();

// Gate every API request using the collection's access descriptor.
cms.use("*", async (c, next) => {
  const collection = getCollection(collectionName(c));
  if (accessFor(collection, c.req.method) === "private") {
    return requireAuth(c, next);
  }
  if (isUnsafe(c.req) && isCrossOrigin(c)) {
    return jsonError("Origem não permitida.", 403);
  }
  return next();
});

cms.get("/:collection/relations", requireAuth, (c) => {
  const collection = getCollection(collectionName(c));
  if (!collection) return jsonError("Coleção não encontrada.", 404);

  const options: Record<string, { id: number; label: string }[]> = {};
  for (const field of collection.fields) {
    if (field.type !== "relation" || !field.relation) continue;
    const target = getCollection(field.relation.to);
    options[field.name] = target
      ? listItems(target, { limit: 100 }).items.map((item) => ({
          id: item.id,
          label: itemLabel(target, item),
        }))
      : [];
  }
  return c.json({ options });
});

cms.get("/:collection", (c) => {
  const collection = getCollection(collectionName(c));
  if (!collection) return jsonError("Coleção não encontrada.", 404);

  if (collection.standalone) {
    return c.json({ item: getStandalone(collection) });
  }

  const url = new URL(c.req.url);
  const page = Number(url.searchParams.get("page") ?? "1") || 1;
  const limit = Number(url.searchParams.get("limit") ?? "10") || 10;
  const q = url.searchParams.get("q") ?? "";
  return c.json(listItems(collection, { page, limit, q }));
});

cms.post("/:collection", async (c) => {
  const collection = getCollection(collectionName(c));
  if (!collection) return jsonError("Coleção não encontrada.", 404);
  if (collection.standalone) {
    return jsonError(
      "Coleção standalone possui um único registro; use PATCH para atualizá-lo.",
      405,
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError("JSON inválido.", 400);
  }

  const result = coerceInput(collection, body, { partial: false });
  if (!result.ok) {
    return Response.json({ message: "Dados inválidos.", errors: result.errors }, { status: 422 });
  }
  const relationErrors = checkRelationTargets(collection, result.values);
  if (Object.keys(relationErrors).length > 0) {
    return Response.json({ message: "Dados inválidos.", errors: relationErrors }, { status: 422 });
  }
  return Response.json({ item: createItem(collection, result.values) }, { status: 201 });
});

cms.patch("/:collection", async (c) => {
  const collection = getCollection(collectionName(c));
  if (!collection) return jsonError("Coleção não encontrada.", 404);
  if (!collection.standalone) {
    return jsonError(
      `Use PATCH ${getCmsConfig().api.path}/:collection/:id para atualizar itens desta coleção.`,
      405,
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError("JSON inválido.", 400);
  }
  const result = coerceInput(collection, body, { partial: true });
  if (!result.ok) {
    return Response.json({ message: "Dados inválidos.", errors: result.errors }, { status: 422 });
  }
  const relationErrors = checkRelationTargets(collection, result.values);
  if (Object.keys(relationErrors).length > 0) {
    return Response.json({ message: "Dados inválidos.", errors: relationErrors }, { status: 422 });
  }
  return c.json({ item: saveStandalone(collection, result.values) });
});

function cmsItem(c: Context<Env>): { collection: CollectionDef; id: number } | Response {
  const collection = getCollection(collectionName(c));
  const id = Number(c.req.param("id"));
  if (!collection) return jsonError("Coleção não encontrada.", 404);
  if (!Number.isInteger(id) || id <= 0) return jsonError("ID inválido.", 400);
  return { collection, id };
}

cms.get("/:collection/:id", (c) => {
  const resolved = cmsItem(c);
  if (resolved instanceof Response) return resolved;
  const item = getItem(resolved.collection, resolved.id);
  return item ? c.json({ item }) : jsonError("Item não encontrado.", 404);
});

async function updateHandler(c: Context<Env>): Promise<Response> {
  const resolved = cmsItem(c);
  if (resolved instanceof Response) return resolved;
  if (!getItem(resolved.collection, resolved.id)) {
    return jsonError("Item não encontrado.", 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError("JSON inválido.", 400);
  }
  const result = coerceInput(resolved.collection, body, { partial: true });
  if (!result.ok) {
    return Response.json({ message: "Dados inválidos.", errors: result.errors }, { status: 422 });
  }
  const relationErrors = checkRelationTargets(resolved.collection, result.values);
  if (Object.keys(relationErrors).length > 0) {
    return Response.json({ message: "Dados inválidos.", errors: relationErrors }, { status: 422 });
  }
  return c.json({ item: updateItem(resolved.collection, resolved.id, result.values) });
}

cms.patch("/:collection/:id", updateHandler);
cms.put("/:collection/:id", updateHandler);

cms.delete("/:collection/:id", (c) => {
  const resolved = cmsItem(c);
  if (resolved instanceof Response) return resolved;
  if (!deleteItem(resolved.collection, resolved.id)) {
    return jsonError("Item não encontrado.", 404);
  }
  return c.json({ ok: true });
});

/* -------------------------------------------------------------------------- */
/* Auth API                                                                   */
/* -------------------------------------------------------------------------- */

const auth = new Hono<Env>();

auth.post("/login", async (c) => {
  if (isCrossOrigin(c)) return jsonError("Origem não permitida.", 403);
  const body = await readBody(c.req.raw);
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const user = email && password ? verifyCredentials(email, password) : null;
  if (!user) return jsonError("E-mail ou senha inválidos.", 401);

  setAuthCookies(c, createSession(user.id));
  return c.json({ user });
});

auth.post("/logout", async (c) => {
  if (isCrossOrigin(c)) return jsonError("Origem não permitida.", 403);
  const user = currentUser(c);
  if (user) revokeUserSessions(user.id);
  clearAuthCookies(c);
  return c.json({ ok: true });
});

auth.post("/refresh", async (c) => {
  if (isCrossOrigin(c)) return jsonError("Origem não permitida.", 403);
  const refresh = getCookie(c, REFRESH_COOKIE);
  const rotated = refresh ? rotateSession(refresh) : null;
  if (!rotated) {
    clearAuthCookies(c);
    return jsonError("Sessão expirada. Faça login novamente.", 401);
  }
  setAuthCookies(c, rotated.tokens);
  return c.json({ user: rotated.user });
});

auth.get("/me", requireAuth, (c) => c.json({ user: c.get("user") }));

auth.get("/users", requireAuth, (c) => c.json({ users: listUsers() }));

auth.post("/users", requireAuth, async (c) => {
  const result = createUser(await readBody(c.req.raw));
  if (!result.ok) {
    return Response.json({ message: "Dados inválidos.", errors: result.errors }, { status: 422 });
  }
  return Response.json({ user: result.value }, { status: 201 });
});

function userId(c: Context<Env>): number | null {
  const id = Number(c.req.param("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

auth.get("/users/:id", requireAuth, (c) => {
  const id = userId(c);
  if (id === null) return jsonError("ID inválido.", 400);
  const user = getUser(id);
  return user ? c.json({ user }) : jsonError("Usuário não encontrado.", 404);
});

async function updateUserHandler(c: Context<Env>): Promise<Response> {
  const id = userId(c);
  if (id === null) return jsonError("ID inválido.", 400);
  const result = updateUser(id, await readBody(c.req.raw));
  if (result === null) return jsonError("Usuário não encontrado.", 404);
  if (!result.ok) {
    return Response.json({ message: "Dados inválidos.", errors: result.errors }, { status: 422 });
  }
  return c.json({ user: result.value });
}

auth.patch("/users/:id", requireAuth, updateUserHandler);
auth.put("/users/:id", requireAuth, updateUserHandler);

auth.delete("/users/:id", requireAuth, (c) => {
  const id = userId(c);
  if (id === null) return jsonError("ID inválido.", 400);
  const requester = c.get("user") as AuthUser;
  const result = deleteUser(id, requester.id);
  if (result === "not_found") return jsonError("Usuário não encontrado.", 404);
  if (result === "self") return jsonError("Você não pode remover o próprio usuário.", 409);
  if (result === "last") return jsonError("Não é possível remover o último usuário.", 409);
  return c.json({ ok: true });
});

/* -------------------------------------------------------------------------- */
/* Media / files / backup                                                     */
/* -------------------------------------------------------------------------- */

function resolveMediaField(collection: CollectionDef | undefined, name: string) {
  if (!collection) return null;
  return (
    collection.fields.find(
      (field) => field.name === name && (field.type === "media" || field.type === "media-list"),
    ) ?? null
  );
}

const media = new Hono<Env>();
media.use("*", requireAuth);

media.post("/", async (c) => {
  const url = new URL(c.req.url);
  const field = resolveMediaField(
    getCollection(url.searchParams.get("collection") ?? ""),
    url.searchParams.get("field") ?? "",
  );
  if (!field) return jsonError("Campo de mídia não encontrado.", 400);

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return jsonError("Upload inválido.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Nenhum arquivo enviado.", 400);

  try {
    return c.json({ media: await saveUpload(file, field) }, 201);
  } catch (error) {
    if (error instanceof MediaError) return jsonError(error.message, error.status);
    throw error;
  }
});

media.delete("/", (c) => {
  const target = new URL(c.req.url).searchParams.get("url");
  if (!target) return jsonError("URL ausente.", 400);
  deleteByUrl(target);
  return c.json({ ok: true });
});

const files = new Hono<Env>();
files.get("/*", (c) => {
  const raw = c.req.path.slice(getCmsConfig().files.path.length);
  const name = decodeURIComponent(raw.replace(/^\/+/, ""));
  const data = readUpload(name);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentTypeFor(name),
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});

const backup = new Hono<Env>();
backup.use("*", requireAuth);

function backupError(error: unknown): Response {
  if (error instanceof BackupError) return jsonError(error.message, error.status);
  console.error("[backup] erro inesperado:", error);
  return jsonError("Não foi possível concluir a operação de backup.", 500);
}

function attachment(buffer: Buffer, name: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

backup.get("/", (c) => {
  const params = new URL(c.req.url).searchParams;
  const name = params.get("name");
  try {
    if (name) {
      const { info, buffer } = readBackup(name);
      return attachment(buffer, info.name);
    }
    if (params.get("latest")) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      return attachment(createBackupBuffer(), `backup-${stamp}.serenojs`);
    }
    return c.json({ backups: listBackups() });
  } catch (error) {
    return backupError(error);
  }
});

backup.post("/", (c) => {
  try {
    return c.json({ backup: createBackup() }, 201);
  } catch (error) {
    return backupError(error);
  }
});

backup.put("/", async (c) => {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await c.req.arrayBuffer());
  } catch {
    return jsonError("Upload inválido.", 400);
  }
  if (buffer.length === 0) return jsonError("Nenhum arquivo enviado.", 400);
  try {
    return c.json({ manifest: restoreBackup(buffer) });
  } catch (error) {
    return backupError(error);
  }
});

backup.delete("/", (c) => {
  const name = new URL(c.req.url).searchParams.get("name");
  if (!name) return jsonError("Nome do backup ausente.", 400);
  try {
    deleteBackup(name);
    return c.json({ ok: true });
  } catch (error) {
    return backupError(error);
  }
});

/* -------------------------------------------------------------------------- */
/* Admin SPA                                                                  */
/* -------------------------------------------------------------------------- */

function readAdminIndex(): string | null {
  try {
    return readFileSync(join(adminDist(), "index.html"), "utf8");
  } catch {
    return null;
  }
}

function runtimePayload() {
  const config = getCmsConfig();
  return {
    title: config.title,
    adminPath: config.admin.path,
    apiPath: config.api.path,
    authPath: config.auth.path,
    mediaPath: config.media.path,
    filesPath: config.files.path,
    backupPath: config.backup.path,
    collections: config.collections,
    locales: config.locales,
    defaultLocale: config.defaultLocale,
  };
}

function adminHeaders(): HeadersInit {
  const config = getCmsConfig();
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    ...(config.admin.noindex
      ? { "X-Robots-Tag": "noindex, nofollow", "X-Frame-Options": "SAMEORIGIN" }
      : {}),
  };
}

function serveAdminIndex(): Response {
  const template = readAdminIndex();
  if (!template) {
    return new Response(
      "Admin bundle ausente. Rode `pnpm build:admin` para gerar packages/serenojs/admin-dist.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
  const config = getCmsConfig();
  const payload = JSON.stringify(runtimePayload()).replace(/</g, "\\u003c");
  const html = template
    .replaceAll("__SERENOJS_CONFIG__", payload)
    .replaceAll("%SERENOJS_TITLE%", config.title);
  return new Response(html, { headers: adminHeaders() });
}

function buildApp(): Hono<Env> {
  const root = new Hono<Env>();

// Admin SPA assets live at a fixed internal path so history routing works at
// any configured admin mount path.
root.get(`${ADMIN_ASSETS_PREFIX}/*`, (c) => {
  if (!getCmsConfig().admin.enabled) return new Response("Not found", { status: 404 });
  const relative = c.req.path.slice(ADMIN_ASSETS_PREFIX.length).replace(/^\/+/, "");
  const target = normalize(join(adminDist(), relative));
  if (!target.startsWith(normalize(adminDist()))) return new Response("Not found", { status: 404 });
  try {
    if (!statSync(target).isFile()) return new Response("Not found", { status: 404 });
    const data = readFileSync(target);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeFor(target),
        "Cache-Control": relative.startsWith("assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
});

root.route(getCmsConfig().api.path, cms);
root.route(getCmsConfig().auth.path, auth);
root.route(getCmsConfig().media.path, media);
root.route(getCmsConfig().files.path, files);
root.route(getCmsConfig().backup.path, backup);

// History routing: every path under the admin mount serves the SPA shell.
// Registered after the routers so it only handles the admin prefix.
root.get("*", (c, next) => {
  const config = getCmsConfig();
  const path = c.req.path;
  const isAdmin =
    path === config.admin.path || path.startsWith(`${config.admin.path}/`);
  if (!isAdmin) return next();
  if (!config.admin.enabled) return new Response("Not found", { status: 404 });
  return serveAdminIndex();
});

  return root;
}

/** Whether a request path belongs to the CMS (and must not reach Waku). */
function owns(path: string): boolean {
  const config = getCmsConfig();
  if (path === ADMIN_ASSETS_PREFIX || path.startsWith(`${ADMIN_ASSETS_PREFIX}/`)) {
    return true;
  }
  const check = (base: string) => path === base || path.startsWith(`${base}/`);
  return (
    check(config.admin.path) ||
    check(config.api.path) ||
    check(config.auth.path) ||
    check(config.media.path) ||
    check(config.files.path) ||
    check(config.backup.path)
  );
}

/**
 * Waku middleware factory.
 *
 * @example
 * // src/middleware/serenojs.ts
 * import config from "../../serenojs.config.js";
 * import { createCmsMiddleware } from "@eutobias/serenojs/server";
 * export default createCmsMiddleware(config);
 */
export function createCmsMiddleware(config: CmsConfig) {
  configureCms(config);
  startBackupScheduler();

  const app = buildApp();
  const handler = app.fetch.bind(app);

  return (_opts?: unknown): MiddlewareHandler => {
    return async (c, next) => {
      const path = new URL(c.req.url).pathname;
      if (!owns(path)) return next();
      return handler(c.req.raw);
    };
  };
}

export { buildApp as createCmsApp };

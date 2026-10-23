# AGENTS.md

## Project

**SerenoJS** — schema-driven CMS packaged as **`@eutobias/serenojs`** (pnpm
workspace at `packages/serenojs`) and demonstrated by this Waku starter.

The host app owns only the schema descriptors (`src/schemas/`) and the config
(`serenojs.config.ts`). The package owns the admin SPA, REST API, auth, media,
uploads, backups and the Hono middleware that mounts all of it. There are **no
admin/auth/API route files in `src/pages`** — the middleware answers those
requests before Waku's file-system router sees them.

User-facing copy and validation messages are **pt-BR**. Code comments mix EN/PT-BR.

## Stack

- Waku `1.0.0-rc.1`, React `~19.3`, `react-server-dom-webpack`
- Hono sub-app mounted from `src/middleware/serenojs.ts`
- Admin SPA: Vite + React 19 + Tailwind v4, built into
  `packages/serenojs/admin-dist`
- React Compiler via `@rolldown/plugin-babel` + `babel-plugin-react-compiler`
- Persistence: `node:sqlite` (`DatabaseSync`), no ORM
- `react-icons` (Feather `Fi*`) for icons
- TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- Runtime: **Node `>=22.15`** or **Bun `>=1.4.3`** (both support `node:sqlite`)

## Commands

```sh
pnpm install
pnpm dev           # build:package + build:admin + waku dev
pnpm build         # build:package + build:admin + waku build
pnpm start         # waku start (serve build)
pnpm typegen       # waku router typegen — rerun after adding/removing pages
pnpm build:package # tsc -> packages/serenojs/dist
pnpm build:admin   # vite -> packages/serenojs/admin-dist
pnpm test          # package tests (Node test runner)
pnpm test:coverage # package tests + coverage report
```

No test runner and no linter are configured. Verify with `pnpm typegen` +
`pnpm build` (or `tsc --noEmit` in both root and the package).

## Layout

```
serenojs.config.ts     # HOST: collections, locales, mount paths
src/
  schemas/             # HOST: SOURCE OF TRUTH for content types
    index.ts           # exports `collections`
    locales.ts         # locale registry + `defaultLocale`
    todos.ts           # example collection
  middleware/
    serenojs.ts        # HOST: one-line mount of @eutobias/serenojs/server
    no-trailing-slash.ts
  pages/
    _layout.tsx        # root layout (static)
    index.tsx          # public page: todos CRUD (client)
  styles.css           # public-page Tailwind entry
  pages.gen.ts         # GENERATED — do not edit

packages/serenojs/
  package.json         # exports: ., ./config, ./runtime, ./server, ./ui
  vite.admin.config.ts
  admin-dist/          # BUILD OUTPUT of the admin SPA
  src/
    config.ts          # defineCmsConfig + public types
    runtime.ts         # configureCms/getCmsConfig/getCollections
    core/              # types, schema helpers, validation, db.server,
                       # media(.server), backup.server
    auth/              # sessions, cookies, users, password hashing
    server/app.ts      # Hono app + createCmsMiddleware (API/auth/SPA)
    ui/                # base components (Box, Text, Button, ...)
    ui/admin/          # admin client components + SPA runtime/router
    admin/             # SPA entry (main.tsx, app.tsx, index.html, styles.css)
  dist/                # BUILD OUTPUT of the server/UI package
```

`@/*` still aliases `src/*` for the host (public page). Inside the package use
relative imports only.

## Architecture rules

- **`src/schemas/` remains the single source of truth.** Each collection lives
  in its own `<name>.ts` exporting a typed `CollectionDef`; `src/schemas/index.ts`
  aggregates them. The host passes them to the package through
  `serenojs.config.ts`. `core/db.server.ts` migrates SQLite lazily (adds missing
  tables/columns; never drops). Restart the dev server after adding a collection.
- **No hardcoded host imports inside the package.** `core/schema.ts` reads the
  runtime config via `runtime.ts`; nothing imports `@/schemas`,
  `@/components`, `@/admin` or `@/auth`.
- **Config is injected once.** `createCmsMiddleware(config)` calls
  `configureCms(config)` at boot. Every server module reads paths/collections
  through `getCmsConfig()` / `getCollections()`.
- **Field types** (`packages/serenojs/src/core/types.ts`): `text | email |
  textarea | number | boolean | select | date | relation | media | media-list |
  list`. Relations: `one-to-one` (INTEGER column), `one-to-many` /
  `many-to-many` (join tables `r_<collection>_<field>`).
- **Standalone collections** (`standalone: true`) hold exactly one record. Use
  `getStandalone` / `saveStandalone`; API exposes `GET`/`PATCH /api/:collection`
  and rejects `POST`/`DELETE` with `405`.
- **Access control** (`CollectionDef.access`) controls `/api/*` per operation:
  `read` (GET/HEAD/OPTIONS, default public), `create` (POST, private), `update`
  (PATCH/PUT, private), `delete` (DELETE, private). Enforcement lives in
  `packages/serenojs/src/server/app.ts`.
- **Server-only modules are `*.server.ts`** and must never reach the admin SPA
  bundle. The SPA only talks HTTP; it never imports `db.server.ts`.
- **Admin UI is client-only** (`"use client"`). It is built as a standalone SPA
  by `vite.admin.config.ts` and served by the middleware.
- **The package is the API.** Contract: `GET/POST /api/:collection`,
  `GET/PATCH/PUT/DELETE /api/:collection/:id`, plus
  `GET /api/:collection/relations` (auth) for relation pickers. Auth:
  `POST /auth/login|logout|refresh`, `GET /auth/me`, user CRUD under
  `/auth/users`. Media `POST/DELETE /media`; uploads `GET /files/*`; backup
  `GET/POST/PUT/DELETE /backup`. Errors return `{ message, errors? }`
  (`400/401/403/404/405/409/422/500`).
- **Validation lives in `coerceInput`** (`core/validation.ts`). Create applies
  defaults to absent fields; update only touches keys present. Relation targets
  are checked via `checkRelationTargets`.
- **Deletes cascade:** `deleteItem` removes join rows and nulls/clears
  references from other collections.

## i18n

### Admin UI language (EN/PT)

- The admin has its own UI language selector (`ui/admin/i18n.tsx`), independent
  from content localization.
- Default is **English**; `Português (BR)` is second. The choice is persisted in
  `localStorage` under `serenojs:admin-locale`.
- Only static UI strings are translated. Collection labels, field labels,
  descriptions, option labels and other schema-driven values are **not**
  translated.
- Components read strings via `useI18n()` → `t("key")`; add new copy to both
  `en` and `pt` dictionaries. The selector lives in the sidebar footer.
- Dates are formatted deterministically and reordered for EN/PT (no
  `toLocaleString`).

### Content localization

- **Locales** are declared in `serenojs.config.ts` (`locales`,
  `defaultLocale = "pt"`). Each collection declares `locales: string[]`; omit to
  fall back to `[defaultLocale]`.
- **Storage is one column per locale** (`name_pt`, `name_en`, ...).
  `storedColumns` expands `FieldDef` into physical columns; `migrate()` renames
  legacy `<field>` to `<field>_<default>` on startup.
- **Which fields localize:** default `text`, `textarea`, `email`, `list`;
  override per field with `localized: true/false`. Non-editorial types never
  localize.
- **API/form shape is nested:** `{ "name": { "pt": "...", "en": "..." } }`.
  Partial updates only touch locales present. Required is enforced in every
  locale; errors are keyed `<field>_<locale>`.
- **Admin:** one tab per locale followed by a fixed **Geral** section; lists
  render the default locale (`valueForLocale`). Locale labels are injected into
  the SPA via `setLocaleLabels`.

## Auth

Opaque DB-backed sessions (no JWT), delivered as httpOnly cookies. The package
owns the full flow.

- **Default login.** First boot seeds **`admin@example.com` / `admin123`**
  (override `ADMIN_EMAIL` / `ADMIN_PASSWORD`). Visit the admin mount path.
- **Tokens.** Random 256-bit strings; only their SHA-256 hash is stored in
  `auth_tokens`. Access TTL **30 min**, refresh TTL **24 h**.
- **Rotation.** Every login/refresh deletes **all** tokens for the user and
  inserts a fresh pair. One active session per user.
- **Transport.** httpOnly + `SameSite=Lax` cookies `serenojs_access` / `serenojs_refresh`.
  `Secure` in production; force with `AUTH_COOKIE_SECURE`.
- **Gate.** `requireAuth` in `server/app.ts` accepts a valid access token,
  rotates a valid refresh (and re-issues cookies), or returns `401` JSON.
  Unsafe cross-origin requests get `403`. The admin SPA calls `/auth/me` and
  renders the login view on `401`.
- **Users** (`auth/users.server.ts`): unique lowercased emails, 8+ char
  passwords hashed with scrypt, hashes never returned. Changing a password
  revokes sessions. Cannot delete yourself or the last user (`409`).

## Admin SPA / hidden routes

- Mounted at `admin.path` (default `/admin`). Assets are served at the fixed
  internal path `/_serenojs/admin/*`; history routing serves the SPA shell for
  any path under the admin mount.
- `admin.enabled: false` → `404` for the panel and assets.
  `admin.noindex: true` → `X-Robots-Tag: noindex, nofollow` + `<meta robots>`.
- `ADMIN_PATH` / `ADMIN_ENABLED` are read by `serenojs.config.ts` at boot.
  Changing the path makes the old path fall through to Waku (usually 404).
- The SPA receives `window.__SERENOJS__` with paths, collections and locales at
  serve time (`__SERENOJS_CONFIG__` placeholder in `admin-dist/index.html`).
- Never rely on obscurity alone: auth is always enforced for private APIs and
  admin endpoints. The SPA shell itself is public (like Payload's admin bundle).
- Routing/helpers live in `packages/serenojs/src/ui/admin/router.tsx` and
  `runtime.tsx` (`useCms`, `useCmsUrls`, `Link`). Components must not import
  `waku` or hardcode `/api`, `/auth`, `/media` or `/backup`.

## Media

- **Media fields** store one served URL (`/files/<name>`). Upload via
  `POST /media?collection=&field=` (protected) validated against `accept`
  (`"image/*"`, `image/png`, `"png"`, `".pdf"`) and `maxSize` (bytes).
- **Media lists** store ordered `{ url, alt?, primary? }` (JSON TEXT, at most
  one `primary`).
- **Lists** store ordered strings (JSON TEXT).
- Files land in `public/files` (gitignored) and are served by the package at
  `GET /files/*` with `nosniff` + sandbox CSP. HTML/executable extensions are
  blocked. Stored URLs must be `/files/...` or `/images/...`.

## Storage

- DB file: `.data/admin.db` (WAL). Override with `ADMIN_DB_PATH` or
  `config.db.path`.
- Created + migrated automatically; admin user seeded on first open.
- `.data/`, `public/files/`, `packages/serenojs/dist/` and
  `packages/serenojs/admin-dist/` are build/runtime artifacts (dist is
  generated; do not edit by hand).

## Backup

- `core/backup.server.ts` bundles a consistent SQLite snapshot (`VACUUM INTO`)
  plus `public/images` and `public/files` into a gzip JSON archive
  (`<name>.serenojs`, base64 assets).
- API (protected): `GET /backup` lists, `GET /backup?name=` downloads,
  `GET /backup?latest=1` creates + downloads, `POST /backup` stores,
  `PUT /backup` restores the raw body, `DELETE /backup?name=` removes.
- Restore copies tables into the live connection inside a transaction (never
  swaps the file), then rewrites assets. Restored tokens can invalidate the
  current session.
- Scheduler starts from `createCmsMiddleware`; runs on startup if overdue and
  every `backup.intervalHours` (default 24), keeping `backup.keep` (default 10).
  Disable with `ADMIN_BACKUP=false` or `backup.enabled: false`.

## Conventions

- Read/create/update/delete helpers live in `core/db.server.ts`; keep SQL there.
- Reuse `Box` and `Text` for the admin UI.
- Admin list columns come from `collection.list`; entries may be field names or
  `id`/`createdAt`/`updatedAt`. Omit `list` to show all fields.
- `collection.icon` is optional and must be a Feather icon name from the
  registry in `ui/admin/collection-icon.tsx`. Never use emoji/unicode glyphs.
- New package files used by the host must be exported through one of the
  package `exports` (`./config`, `./runtime`, `./server`, `./ui`). Types shipped
  by the package come from `dist/*.d.ts` (`pnpm build:package`).

## Gotchas

- `src/pages.gen.ts` is generated by `pnpm typegen`. Never edit by hand. The
  admin routes are no longer files, so typegen only covers public pages.
- **Layouts are static by default.** Any page/layout that reads request data
  must export `getConfig` with `render: "dynamic"`.
- The public page `/` is a client component and uses the public `/api/*` API.
- The admin SPA must be rebuilt (`pnpm build:admin`) after changing
  `packages/serenojs/src/admin` or `src/ui`. `pnpm dev` does it automatically;
  a running `waku dev` will not hot-reload the SPA bundle.
- `@eutobias/serenojs` ships compiled `dist/` + `admin-dist/`. Run
  `pnpm build:package` before testing the host if you changed package source.
- The backup scheduler and DB open lazily on first request; module-level code
  must not call `getCmsConfig()` before `configureCms`.
- `docs/llms.txt` (in the original repo) is the full Waku reference — consult it
  for framework APIs before guessing.

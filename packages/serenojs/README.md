# SerenoJS

Package: `@eutobias/serenojs`

A schema-driven CMS for [Waku](https://waku.gg) (React 19 RSC +
file-system routing). The admin panel, REST API, form validation and SQLite
schema are generated from collection descriptors.

The package ships:

- an auto-generated **admin SPA** with list/search/pagination, create/edit
  drawers, standalone editors, users and backups;
- a **REST API** with per-operation access control;
- **cookie authentication** with rotating refresh tokens and user management;
- **media uploads** and a safe file endpoint;
- **backup/restore** with an optional periodic scheduler;
- a **Hono middleware** that mounts everything in one line.

It works as a regular CMS with the bundled admin, or as a **headless CMS**
consumed by any frontend.

## Features

- **Schema-driven** — the admin, API validation and SQLite schema come from
  `CollectionDef` descriptors.
- **Configurable, hideable admin** — mount path, enable/disable and `noindex`
  are configuration options. Disabling the admin returns `404` for the panel and
  its assets.
- **Admin UI language selector** — English (default) and Portuguese (BR),
  persisted in `localStorage`. Only admin UI strings are translated; collection
  and field labels from the schema are not translated.
- **Headless-ready** — the REST API is the content delivery layer; the admin is
  only an editing client. Any frontend or stack can consume the content.
- **Rich field types** — text, e-mail, textarea, number, boolean, select, date,
  relation, media, media-list and list.
- **Content localization (i18n)** — localized fields stored per locale
  (`name_pt`, `name_en`, ...) with nested API/form values.
- **Relations** — `one-to-one`, `one-to-many` and `many-to-many`, with cascade
  cleanup on delete.
- **Authentication** — opaque cookie sessions (no JWT), rotating refresh tokens,
  user management and CSRF protection for unsafe requests.
- **Media uploads** — type/size validation, safe file serving and media lists.
- **Backups** — consistent SQLite snapshot plus assets in a single archive, with
  restore and an optional periodic scheduler.

## Stack / requirements

- Waku `1.0.0-rc.1`, React `~19.3`, `react-server-dom-webpack`
- Hono for the API/auth/admin middleware
- Admin SPA: Vite + React 19 + Tailwind CSS v4 (prebuilt in this package)
- `node:sqlite` (`DatabaseSync`), no ORM
- `react-icons` (Feather icons) in the admin
- TypeScript

**Node:** `>=22.15` (required for `node:sqlite`).

Peer dependencies: `waku`, `react`, `react-dom`.

## Install

```sh
pnpm add @eutobias/serenojs
```

The package is ESM-only and ships compiled `dist/` plus the prebuilt
`admin-dist/` SPA.

## Setup

### 1. Create `serenojs.config.ts`

```ts
import { defineCmsConfig } from "@eutobias/serenojs/config";

export default defineCmsConfig({
  title: "My CMS",
  collections: [/* CollectionDef[] */],
  admin: { path: "/admin", enabled: true, noindex: true },
  api: { path: "/api" },
  auth: { path: "/auth" },
  media: { path: "/media" },
  files: { path: "/files" },
  backup: { path: "/backup", enabled: true, intervalHours: 24, keep: 10 },
  db: { path: ".data/admin.db" },
});
```

All paths are configurable. The package defaults are exactly the values above;
change `api.path` to `/content` or any other prefix if `/api` conflicts with
existing host routes.

### 2. Mount the middleware

Create `src/middleware/serenojs.ts`:

```ts
import config from "../../serenojs.config";
import { createCmsMiddleware } from "@eutobias/serenojs/server";

export default createCmsMiddleware(config);
```

Waku auto-loads every module in `src/middleware`. Requests under the configured
admin/API/auth/media/files/backup prefixes are answered by the package; every
other request falls through to the host's Waku pages.

### 3. Build the host

The admin SPA is already built inside the package. You do **not** need to add
Tailwind scanning for the package. Run your normal Waku build:

```sh
pnpm build
pnpm start
```

### First login

1. Start the host app and open `/admin` (or your configured `admin.path`).
2. Sign in with the seeded account:
   - **E-mail:** `admin@example.com`
   - **Password:** `admin123`

The SQLite database is created at `.data/admin.db` and migrated automatically on
first use. The admin user is seeded only when the auth table is empty, so set
`ADMIN_EMAIL` and `ADMIN_PASSWORD` **before the first boot** to override the
defaults.

### Hiding the admin

```ts
admin: { path: "/painel", enabled: true, noindex: true }
```

Set `enabled: false` to return `404` for the admin shell and
`/_serenojs/admin/*` assets. `noindex: true` sends `X-Robots-Tag: noindex,
nofollow` from the package (the shell also contains a robots meta tag).

This is a discoverability layer, not a security boundary: the SPA shell is
public, while private APIs and admin data remain protected by authentication.

## Headless usage

The admin is only an editing client; the REST API is the delivery layer. You can
run the package as a **headless CMS** and consume the API from any frontend or
service — Next.js, Astro, SvelteKit, mobile apps or a static site generator.

```ts
const response = await fetch("https://cms.example.com/api/posts?limit=20");
const { items } = await response.json();
```

Set `access.read` to `"public"` for content the frontend should read
anonymously, and keep `create`/`update`/`delete` private. The API is same-origin
by default; add CORS at the host/proxy layer if a browser frontend consumes it
cross-origin. Server-side consumers can call the API directly.

Media values are returned as URLs (`/files/...` or `/images/...`), so a frontend
can render them directly. For localized content, parse the nested values:

```json
{ "title": { "pt": "Olá", "en": "Hello" } }
```

## Configuration

| Option | Default | Description |
|---|---|---|
| `title` | `"SerenoJS"` | Admin title |
| `collections` | — | Array of `CollectionDef` |
| `locales` | `pt`, `en` | Locale registry used by admin content tabs |
| `defaultLocale` | `"pt"` | Fallback/storage locale |
| `admin.path` | `"/admin"` | Admin SPA mount path |
| `admin.enabled` | `true` | `false` returns 404 for the panel and assets |
| `admin.noindex` | `true` | Send noindex headers/meta tags |
| `api.path` | `"/api"` | REST API mount path |
| `auth.path` | `"/auth"` | Auth API mount path |
| `media.path` | `"/media"` | Upload/delete endpoint |
| `files.path` | `"/files"` | Served uploads |
| `backup.path` | `"/backup"` | Backup API |
| `backup.enabled` | `true` | Enable the periodic backup scheduler |
| `backup.intervalHours` | `24` | Scheduler interval |
| `backup.keep` | `10` | Number of stored backups to keep |
| `db.path` | `".data/admin.db"` | SQLite file path |

The package also reads these environment variables:

| Variable | Effect |
|---|---|
| `ADMIN_DB_PATH` | Overrides `db.path` |
| `ADMIN_EMAIL` | Initial admin e-mail (first boot only) |
| `ADMIN_PASSWORD` | Initial admin password (first boot only) |
| `ADMIN_BACKUP` | `"false"` disables the scheduler |
| `ADMIN_BACKUP_INTERVAL_HOURS` | Scheduler interval |
| `ADMIN_BACKUP_KEEP` | Number of backups to retain |
| `AUTH_COOKIE_SECURE` | `"true"` / `"false"` forces the cookie `Secure` flag |

Path options can be wired to your own environment variables in
`serenojs.config.ts`.

## Schema documentation

Each collection is a `CollectionDef` exported from a schema file and collected
into an array:

```ts
import type { CollectionDef } from "@eutobias/serenojs/config";

export const posts: CollectionDef = {
  slug: "posts",
  label: "Posts",
  icon: "fileText",
  description: "Blog posts",
  access: {
    read: "public",
    create: "private",
    update: "private",
    delete: "private",
  },
  locales: ["pt", "en"],
  list: ["id", "title", "publishedAt", "createdAt"],
  fields: [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "slug", label: "Slug", type: "text", required: true, localized: false },
    { name: "body", label: "Body", type: "textarea" },
    { name: "publishedAt", label: "Published at", type: "date" },
    { name: "published", label: "Published", type: "boolean", defaultValue: false },
    { name: "cover", label: "Cover", type: "media", accept: ["image/*"] },
  ],
};
```

```ts
// src/schemas/index.ts
import type { CollectionDef } from "@eutobias/serenojs/config";
import { posts } from "./posts";

export const collections: CollectionDef[] = [posts];
```

### `CollectionDef`

| Property | Type | Default | Description |
|---|---|---|---|
| `slug` | `string` | — | Unique id; used in the API URL and table name (`c_<slug>`) |
| `label` | `string` | — | Admin label (not translated by the UI language selector) |
| `icon` | `CollectionIconName?` | `grid` | Feather icon from the admin registry |
| `description` | `string?` | — | Optional admin help text |
| `access` | `CollectionAccess?` | see below | Per-operation API access |
| `standalone` | `boolean?` | `false` | Exactly one record; no table/create/delete |
| `locales` | `string[]?` | `[defaultLocale]` | Content locales stored by this collection |
| `list` | `string[]?` | all fields | Admin list columns; also accepts `id`, `createdAt`, `updatedAt` |
| `fields` | `FieldDef[]` | — | Field definitions |

Available icons: `archive`, `box`, `fileText`, `folder`, `grid`, `image`,
`layout`, `settings`, `star`, `tag`, `user`, `users`.

### `FieldDef`

| Property | Type | Applies to | Description |
|---|---|---|---|
| `name` | `string` | all | Stable key and column name |
| `label` | `string` | all | Admin label (schema-defined, not UI-translated) |
| `type` | `FieldType` | all | One of the types below |
| `required` | `boolean?` | all | Required per locale for localized fields |
| `placeholder` | `string?` | all | Input placeholder |
| `help` | `string?` | all | Help text below the input |
| `localized` | `boolean?` | all | Overrides the type's default localization |
| `defaultValue` | `string \| number \| boolean?` | all | Initial value |
| `options` | `{ label, value }[]?` | `select` | Allowed options |
| `min` / `max` | `number?` | `number` | Numeric range |
| `relation` | `{ to, type }?` | `relation` | Target collection and relation type |
| `accept` | `string[]?` | `media`, `media-list` | MIME types and/or extensions |
| `maxSize` | `number?` | `media`, `media-list` | Maximum upload size in bytes |

### Field types

| Type | Value | Localized by default | Notes |
|---|---|---|---|
| `text` | string | yes | Single-line text |
| `email` | string | yes | Validated e-mail |
| `textarea` | string | yes | Multi-line text |
| `number` | number | no | Uses `min`/`max` |
| `boolean` | boolean | no | Stored as INTEGER `0`/`1` |
| `select` | string | no | Requires `options` |
| `date` | string | no | Date input |
| `relation` | number / number[] | no | See relations below |
| `media` | string URL | no | One upload (`/files/...` or `/images/...`) |
| `media-list` | `{ url, alt?, primary? }[]` | no | Ordered list; at most one `primary` |
| `list` | string[] | yes | Ordered list of short strings |

Set `localized: false` on a `text` field to keep it language-independent (for
example a slug).

### Access control

`access` maps HTTP operations to `"public"` or `"private"`:

| Key | Methods | Default |
|---|---|---|
| `read` | `GET`, `HEAD`, `OPTIONS` | `public` |
| `create` | `POST` | `private` |
| `update` | `PATCH`, `PUT` | `private` |
| `delete` | `DELETE` | `private` |

`private` requires a valid session cookie. Omit `access` to use these defaults.

### Content localization

- Localized by default: `text`, `textarea`, `email`, `list`.
- Never localized: `number`, `boolean`, `date`, `select`, `relation`, `media`,
  `media-list`.
- Storage uses one column per locale: `title_pt`, `title_en`, etc.
- API and form values are nested:

```json
{
  "title": { "pt": "Olá", "en": "Hello" }
}
```

- Partial updates only touch the locales present in the payload.
- `required` is enforced in every locale. Validation errors are keyed
  `<field>_<locale>` (for example `title_en`).

### Relations

```ts
relation: { to: "authors", type: "one-to-one" }
relation: { to: "tags", type: "many-to-many" }
```

- `one-to-one` stores a single target id in an INTEGER column.
- `one-to-many` and `many-to-many` use a join table named
  `r_<collection>_<field>`.
- `to` must be the slug of another registered collection.
- Deleting an item removes join rows and clears references from other
  collections.

### Standalone collections

A standalone collection (`standalone: true`) has exactly one record. The admin
renders a single inline form, and the API exposes:

- `GET /api/<collection>` → `{ item }`
- `PATCH /api/<collection>` → `{ item }`

`POST` and `DELETE` return `405` for standalone collections.

### Database migration

The SQLite schema is created and migrated lazily on first open. Missing tables
and columns are added automatically; existing data is not dropped. Legacy
single-column localized data is renamed to `<field>_<defaultLocale>` during
migration.

## REST API

Default mount points:

- CMS API: `/api`
- Auth API: `/auth`
- Media uploads: `/media`
- Served files: `/files/*`
- Backups: `/backup`
- Admin: `/admin` (assets at `/_serenojs/admin/*`)

JSON is used for requests and responses, except for file downloads/uploads.
Errors use:

```json
{ "message": "Dados inválidos.", "errors": { "title_en": "Campo obrigatório." } }
```

Common status codes: `400`, `401`, `403`, `404`, `405`, `409`, `413`, `422`,
`500`.

### CMS endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/:collection` | List items (`?page=1&limit=10&q=search`) |
| `POST` | `/api/:collection` | Create an item |
| `GET` | `/api/:collection/:id` | Read one item |
| `PATCH` / `PUT` | `/api/:collection/:id` | Partially update an item |
| `DELETE` | `/api/:collection/:id` | Delete an item |
| `GET` | `/api/:collection` | Standalone: read the single record |
| `PATCH` | `/api/:collection` | Standalone: update the single record |
| `GET` | `/api/:collection/relations` | Relation picker options (auth required) |

List response:

```json
{
  "items": [{ "id": 1, "createdAt": "...", "updatedAt": "...", "title": "..." }],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

Mutations return `{ "item": { ... } }`; deletes return `{ "ok": true }`.
Relation options return `{ "options": { "author": [{ "id": 1, "label": "..." }] } }`.

### Auth endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Body `{ email, password }`; sets session cookies |
| `POST` | `/auth/logout` | Revokes the session and clears cookies |
| `POST` | `/auth/refresh` | Rotates the refresh token |
| `GET` | `/auth/me` | Current user |
| `GET` | `/auth/users` | List users (auth) |
| `POST` | `/auth/users` | Create user (auth) |
| `GET` | `/auth/users/:id` | Read user (auth) |
| `PATCH` / `PUT` | `/auth/users/:id` | Update user (auth) |
| `DELETE` | `/auth/users/:id` | Delete user (auth; cannot delete self or the last user) |

Session cookies are `serenojs_access` (30 min) and `serenojs_refresh` (24 h), httpOnly and
`SameSite=Lax`. Login/refresh rotate the token pair, so only one session per
user is active. Unsafe cross-origin requests are rejected with `403`.

### Media and files

| Method | Path | Description |
|---|---|---|
| `POST` | `/media?collection=<slug>&field=<name>` | Multipart upload, field name `file` (auth) |
| `DELETE` | `/media?url=/files/<name>` | Delete an uploaded file (auth) |
| `GET` | `/files/<name>` | Serve an uploaded file |

`accept` accepts MIME types (`image/png`, `image/*`) or extensions (`png`,
`.pdf`). When omitted, images and PDFs are allowed. HTML/script/executable
extensions are always blocked. The default maximum size is 10 MB unless
`maxSize` is set. `media` values must be `/files/...` or `/images/...`.

### Backup endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/backup` | List stored backups |
| `GET` | `/backup?name=<file>` | Download one backup |
| `GET` | `/backup?latest=1` | Create and download a fresh backup |
| `POST` | `/backup` | Create and store a backup |
| `PUT` | `/backup` | Restore a raw `.serenojs` archive body |
| `DELETE` | `/backup?name=<file>` | Delete a stored backup |

All backup endpoints require authentication. A backup contains a consistent
SQLite snapshot plus files under `public/images` and `public/files`. Restoring
replaces the live tables in a transaction and rewrites assets; it may invalidate
the current session.

## API examples

The examples assume `http://localhost:3000` and the default paths. The shown
collection is named `posts`; replace it with your own slug. Writes use the
default `private` access, so they include the session cookie.

### List and create

```sh
curl "http://localhost:3000/api/posts?page=1&limit=10&q=test"

curl -b cookies.txt -X POST "http://localhost:3000/api/posts" \
  -H "Content-Type: application/json" \
  -d '{
    "title": { "pt": "Olá", "en": "Hello" },
    "slug": "hello",
    "published": false
  }'
```

### Read, update and delete

```sh
curl "http://localhost:3000/api/posts/1"

curl -b cookies.txt -X PATCH "http://localhost:3000/api/posts/1" \
  -H "Content-Type: application/json" \
  -d '{ "published": true }'

curl -b cookies.txt -X DELETE "http://localhost:3000/api/posts/1"
```

### Login and authenticated requests

```sh
curl -c cookies.txt -X POST "http://localhost:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{ "email": "admin@example.com", "password": "admin123" }'

curl -b cookies.txt "http://localhost:3000/auth/me"
curl -b cookies.txt "http://localhost:3000/auth/users"
curl -b cookies.txt "http://localhost:3000/backup"
```

### Localized payload

```sh
curl -X PATCH "http://localhost:3000/api/posts/1" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": { "pt": "Sobre nós", "en": "About us" }
  }'
```

If the field has `localized: false`, send a flat value instead:
`{ "title": "About us" }`.

### Standalone record

```sh
curl -b cookies.txt "http://localhost:3000/api/settings"

curl -X PATCH "http://localhost:3000/api/settings" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{ "siteName": "My site" }'
```

### Relation options

```sh
curl -b cookies.txt "http://localhost:3000/api/posts/relations"
```

### Media upload

```sh
curl -b cookies.txt -X POST \
  "http://localhost:3000/media?collection=posts&field=cover" \
  -F "file=@./cover.png"
```

Response:

```json
{
  "media": {
    "url": "/files/1720000000000-abc123.png",
    "name": "1720000000000-abc123.png",
    "size": 12345,
    "type": "image/png"
  }
}
```

### Backup

```sh
curl -b cookies.txt "http://localhost:3000/backup"
curl -b cookies.txt -o backup.serenojs "http://localhost:3000/backup?latest=1"
curl -b cookies.txt -X PUT "http://localhost:3000/backup" --data-binary @backup.serenojs
```

## Storage

- Database: `.data/admin.db` (WAL mode; override with `ADMIN_DB_PATH` or
  `db.path`).
- Uploads: `public/files/`.
- Backups: `.data/backups/`.
- The database and admin user are created automatically on first use.

## Exports

| Subpath | Contents |
|---|---|
| `@eutobias/serenojs/config` | `defineCmsConfig`, `CollectionDef`, `FieldDef` and related types |
| `@eutobias/serenojs/runtime` | `configureCms`, `getCmsConfig`, `getCollections` (server) |
| `@eutobias/serenojs/server` | `createCmsMiddleware` |
| `@eutobias/serenojs/ui` | Base UI components (`Box`, `Text`, `Button`, ...) |

## Notes

- The admin UI ships an English/Portuguese (BR) language selector. English is
  the default; the choice is stored in `localStorage`. Schema labels are not
  translated.
- The admin SPA is prebuilt (`admin-dist/`); host Tailwind does not need to scan
  the package.
- The package is server-first: `dist/core/*.server.js` imports `node:sqlite`
  and must never be imported by client code.
- `src/` is included for source maps/debugging; published code resolves from
  `dist/`.

## Testing

The package uses Node's built-in test runner (`node --test`) against source
modules compiled to `dist/`. No external services are required: the API test
creates a temporary SQLite database and cleans it up afterwards.

From the repository root (recommended, because it also builds the admin SPA):

```sh
pnpm test           # build admin + dist, then run all tests
pnpm test:coverage  # same suite with Node coverage report
```

From `packages/serenojs`, `pnpm test` compiles `dist/` and runs the suite. The
admin-shell tests are skipped automatically when `admin-dist/` has not been
built yet.

Coverage includes:

- configuration defaults and mount-path normalization;
- schema helpers, localized values and relation helpers;
- validation/coercion for field types, defaults, partial updates and errors;
- REST API integration: auth cookies, public/private access, CRUD, standalone
  collections, relation options and error responses;
- refresh-token rotation and expired access-token rotation;
- user CRUD and validation;
- media upload/serve/delete, type/size limits and path traversal;
- backup create/list/download/restore/delete and format validation;
- admin shell/assets, history fallback, disable switch and `noindex` header.

## Building and publishing (maintainers)

From the repository root:

```sh
pnpm test             # build admin + dist, run the test suite
pnpm pack:package     # build everything and create the tarball
pnpm publish:package  # build everything and publish to npm
```

Or manually:

```sh
pnpm build:package   # tsc -> packages/serenojs/dist
pnpm build:admin     # Vite -> packages/serenojs/admin-dist
cd packages/serenojs
npm pack --dry-run   # inspect the tarball
npm publish          # access: public is set in publishConfig
```

Both `dist/` and `admin-dist/` must exist before packing/publishing. The package
`files` list includes `dist`, `admin-dist`, `src` and `README.md`; tests are
excluded. `publishConfig.access` is `public`, so the first publish of the scoped
package does not need `--access public` (passing it is harmless).

## License

MIT

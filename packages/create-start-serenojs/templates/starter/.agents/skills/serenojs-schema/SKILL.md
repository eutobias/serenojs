---
name: serenojs-schema
description: Use when creating, editing, or designing a SerenoJS collection descriptor (schema) — adding a new collection or field, configuring relations, standalone collections, access control, or localization — in the src/schemas directory of this project.
---

# SerenoJS — Collection schema

This project's admin panel, REST API, validation and SQLite tables are all
generated from `CollectionDef` descriptors in `src/schemas/`. The schema is the
single source of truth. Get the descriptor right and everything else follows.

Mount paths (admin, API, auth, media, files, backup) and the global locale
registry live in `serenojs.config.ts`. Collections reference those settings but
never hardcode paths.

## When to use

- Adding a new collection.
- Adding/editing a field on an existing collection.
- Configuring relations, standalone records, access control, or locales.

When NOT to use: hand-writing SQL tables/forms (never do that), or editing the
admin UI/API routes directly (those are generated at runtime).

## Process (do this every time)

1. Read `references/fields.md` to pick the right field type and options.
2. Create `src/schemas/<name>.ts` exporting a typed `CollectionDef`.
   Start from `assets/collection.template.ts`.
3. Register it in `src/schemas/index.ts` (add to the `collections` array).
4. Restart the dev server — the DB migrates lazily on first open.
5. Verify: `pnpm typegen` (only if you also added pages) and `pnpm build`
   (or `tsc --noEmit`).

No route files or admin rebuilds are needed: the package generates the admin
forms, API handlers and validation from the descriptors.

## Descriptor anatomy

```ts
import type { CollectionDef } from "@eutobias/serenojs/config";

export const todos: CollectionDef = {
  slug: "todos",          // URL + table name source (kebab-case)
  label: "Tarefas",       // shown in admin UI
  icon: "box",            // optional Feather icon name (see registry below)
  description: "...",     // optional
  standalone: false,      // true = single-record collection
  locales: ["pt", "en"],  // omit to fall back to [defaultLocale]
  list: ["id", "title", "done"],  // list-view columns; omit = all fields
  access: {               // per-operation API access (see below)
    read: "public",
    create: "private",
    update: "private",
    delete: "private",
  },
  fields: [
    { name: "title", label: "Título", type: "text", required: true },
  ],
};
```

`list` accepts field names plus the managed columns `id`, `createdAt` and
`updatedAt`. `locales` must be a subset of the registry in
`src/schemas/locales.ts` (re-exported by `serenojs.config.ts`).

## Field rules

- `name` is the stable identifier (snake_case/camelCase). It becomes the API
  key and the physical column name (or `<name>_<locale>` when localized).
- `label` is shown in the admin UI. Schema labels are **not** translated by the
  admin language selector (EN/PT) — write them in the language your editors
  use.
- `type` must be one of the 11 field types — see `references/fields.md`.
- `required` is enforced per locale for localized fields (no fallback).

## Localization (`localized`)

- Defaults to `true` for `text`, `textarea`, `email`, `list`; `false` for the
  rest (`number`, `boolean`, `date`, `select`, `relation`, `media`,
  `media-list`).
- Set `localized: false` to keep a text field language-independent (e.g. `slug`,
  `url`, `icon`).
- Storage is one column per locale (`name_pt`, `name_en`); the API/form shape is
  nested `{ "name": { "pt": "...", "en": "..." } }`.
- Partial updates only touch the locales present in the payload.
- Admin lists and relation labels render the default locale.
- A collection without any localized field renders only the "Geral" section in
  the admin (no locale tabs).

## Access control (`access`)

Each key maps to HTTP methods on `<api.path>/<slug>` — by default
`/api/<slug>`, configurable through `serenojs.config.ts` (`api.path`):

| key | method | default |
|---|---|---|
| `read` | `GET` / `HEAD` / `OPTIONS` | `"public"` |
| `create` | `POST` | `"private"` |
| `update` | `PATCH` / `PUT` | `"private"` |
| `delete` | `DELETE` | `"private"` |

`"public"` = no auth; `"private"` = auth required. Omit `access` for defaults.

## API shape

With the default API mount (`/api`):

- `GET /api/<slug>?page=1&limit=10&q=search` →
  `{ items, total, page, limit, totalPages }`.
- `GET /api/<slug>/:id` → `{ item }`.
- `POST /api/<slug>` → `{ item }` (201).
- `PATCH` / `PUT /api/<slug>/:id` → `{ item }`. `PUT` uses the same partial
  update handler as `PATCH`; it is not a full replace.
- `DELETE /api/<slug>/:id` → `{ ok: true }`.
- `GET /api/<slug>/relations` → `{ options }` (auth required).
- Errors: `{ message, errors? }` with `400/401/403/404/405/409/422/500`.

Never hardcode the API prefix in clients — read it from the CMS config (`/api` by default).

## Relations (`type: "relation"`)

```ts
{ name: "author", label: "Autor", type: "relation", relation: { to: "users", type: "one-to-one" } }
{ name: "tags", label: "Tags", type: "relation", relation: { to: "tags", type: "many-to-many" } }
```

- `one-to-one` → INTEGER column (single id).
- `one-to-many` / `many-to-many` → join table `r_<collection>_<field>`.
- Target `to` must be the slug of another registered collection.
- Deletes cascade: `deleteItem` removes join rows and nulls/clears references.

## Standalone collections

`standalone: true` = exactly one record. The admin shows an inline form (no
table/CRUD); the API exposes `GET` and `PATCH <api.path>/<slug>` (no id) and
rejects `POST`/`DELETE` with `405`. Both return the single record as `{ item }`.

## Icon registry

`collection.icon` must be one of the Feather names registered in the package at
`@eutobias/serenojs` → `src/ui/admin/collection-icon.tsx`:

`archive`, `box`, `fileText`, `folder`, `grid`, `image`, `layout`, `settings`,
`star`, `tag`, `user`, `users`.

Never use emoji/unicode glyphs. Unknown names fall back to `grid`.

## Common mistakes

- Forgetting to register the collection in `src/schemas/index.ts` — it silently
  won't appear.
- Renaming a field `name` after data exists — `migrate()` adds a new column, it
  does not rename (except the legacy single→localized column case).
- Assuming `write` exists as an access key — it was replaced by
  `create`/`update`/`delete`.
- Setting a relation `to` slug that isn't registered.
- Using a field type outside the 11 supported types.
- Hardcoding the API prefix (`/api`) in frontend code — paths come from the config.
- Expecting schema labels to be translated by the admin UI language selector.

## Reference files

- `references/fields.md` — full field-type reference with options per type.
- `assets/collection.template.ts` — copy-paste starting point.

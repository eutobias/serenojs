# Field type reference

Every field is a `FieldDef` exported from `@eutobias/serenojs/config` (package
source: `src/core/types.ts`). Common props first, then per-type options.

## Common props (all types)

| prop | type | notes |
|---|---|---|
| `name` | `string` | stable id, API key, column name |
| `label` | `string` | admin label; not translated by the UI language selector |
| `type` | `FieldType` | one of the 11 below |
| `required?` | `boolean` | per-locale for localized fields |
| `placeholder?` | `string` | input placeholder |
| `help?` | `string` | helper text under the field |
| `localized?` | `boolean` | override the per-type default |
| `defaultValue?` | `string \| number \| boolean` | applied on create when the field is absent |

`createdAt` and `updatedAt` are managed by the package; do not declare them as
fields. They can be used in `collection.list`.

## Types

### text
Single-line string. Localized by default.
```ts
{ name: "title", label: "Título", type: "text", required: true }
```

### email
String validated against an email regex. Localized by default.
```ts
{ name: "email", label: "E-mail", type: "email", required: true }
```

### textarea
Multi-line string. Localized by default.
```ts
{ name: "description", label: "Descrição", type: "textarea" }
```

### number
Number, coerced and range-checked. Options: `min`, `max`. Not localized.
On create it defaults to `min` (or `0`).
```ts
{ name: "order", label: "Ordem", type: "number", min: 0, defaultValue: 0 }
```

### boolean
Checkbox. Stored as INTEGER 0/1. Not localized. Defaults to `false` on create.
```ts
{ name: "done", label: "Concluída", type: "boolean", defaultValue: false }
```

### select
Single choice from `options`. Not localized. `defaultValue` should match one
of the option values; when omitted, the first option is used.
```ts
{
  name: "priority", label: "Prioridade", type: "select",
  options: [
    { label: "Baixa", value: "low" },
    { label: "Média", value: "medium" },
    { label: "Alta", value: "high" },
  ],
  defaultValue: "medium",
}
```

### date
Date input, stored as a `TEXT` string (ISO `YYYY-MM-DD`). Not localized.
```ts
{ name: "dueDate", label: "Prazo", type: "date" }
```

### relation
Reference to another collection. Requires `relation: { to, type }`. Not localized.
- `type`: `"one-to-one"` | `"one-to-many"` | `"many-to-many"`.
- `one-to-one` → single INTEGER column.
- `one-to-many` / `many-to-many` → join table `r_<collection>_<field>`.
- Values are numeric ids (or arrays of ids for the join-table variants).
- Defaults to `null` (`one-to-one`) or an empty array on create.

```ts
{ name: "author", label: "Autor", type: "relation", relation: { to: "users", type: "one-to-one" } }
{ name: "tags", label: "Tags", type: "relation", relation: { to: "tags", type: "many-to-many" } }
```

### media
Single upload, stored as the served URL at the configured files path (default
`/files/<name>`). Options: `accept` (MIME types or extensions), `maxSize`
(bytes). Omit `accept` to allow only images and PDFs; `maxSize` defaults to
10 MB. Not localized.
```ts
{ name: "cover", label: "Capa", type: "media", accept: ["image/*"], maxSize: 5 * 1024 * 1024 }
```

### media-list
Ordered array of `{ url, alt?, primary? }` (at most one `primary`). Stored as
JSON in a `TEXT` column. Options: `accept`, `maxSize` (default 10 MB). The
first item becomes `primary` when none is marked. Not localized.
```ts
{ name: "medias", label: "Mídias", type: "media-list", accept: ["image/*"] }
```

### list
Ordered array of short strings (JSON in a `TEXT` column). Defaults to an empty
array. Localized by default.
```ts
{ name: "highlights", label: "Destaques", type: "list" }
```

## Localization defaults

| default | types |
|---|---|
| localized | `text`, `textarea`, `email`, `list` |
| not localized | `number`, `boolean`, `date`, `select`, `relation`, `media`, `media-list` |

Override with `localized: true/false` on any field. Localized columns are
`<name>_<locale>` and required is checked for every locale.

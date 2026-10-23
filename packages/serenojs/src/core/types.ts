/** Feather icon names curated by the admin icon registry. */
export type CollectionIconName =
  | "archive"
  | "box"
  | "fileText"
  | "folder"
  | "grid"
  | "image"
  | "layout"
  | "settings"
  | "star"
  | "tag"
  | "user"
  | "users";

/**
 * Shared descriptor types for the SerenoJS.
 *
 * The whole admin panel is generated from the collection descriptors in
 * `src/schemas`. These types describe those descriptors.
 */

export type FieldType =
  | "text"
  | "email"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "date"
  | "relation"
  | "media"
  | "media-list"
  | "list";

export type SelectOption = {
  label: string;
  value: string;
};

export type RelationType =
  | "one-to-one"
  | "one-to-many"
  | "many-to-many";

export type RelationDef = {
  /** Slug of the target collection. */
  to: string;
  type: RelationType;
};

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  /** Only for `select` fields. */
  options?: SelectOption[];
  /** Only for `number` fields. */
  min?: number;
  max?: number;
  /** Only for `relation` fields. */
  relation?: RelationDef;
  /**
   * Only for `media` fields. Accepted types as MIME types (`image/png`,
   * `image/*`) or extensions (`png`, `.png`). Uploads are stored under
   * `public/files` and the field value is the served URL (`/files/<name>`).
   * Omit to allow only images and PDFs.
   */
  accept?: string[];
  /** Only for `media` fields. Maximum upload size in bytes. */
  maxSize?: number;
  /**
   * Whether the field is stored per locale (`name_pt`, `name_en`). When
   * omitted it defaults to `true` for editorial types (`text`, `textarea`,
   * `email`, `list`) and `false` for structural ones. Set explicitly to force
   * a text field (e.g. `slug`, `icon`) to stay language-independent.
   */
  localized?: boolean;
  defaultValue?: string | number | boolean;
};

export type CollectionAccess = {
  /**
   * Who can read (GET) this collection's API. Defaults to `"public"`.
   */
  read?: "public" | "private";
  /**
   * Who can create (POST) items. Defaults to `"private"`.
   */
  create?: "public" | "private";
  /**
   * Who can update (PATCH/PUT) items. Defaults to `"private"`.
   */
  update?: "public" | "private";
  /**
   * Who can delete (DELETE) items. Defaults to `"private"`.
   */
  delete?: "public" | "private";
};

export type CollectionDef = {
  slug: string;
  label: string;
  /** Optional Feather icon name (see `src/components/admin/collection-icon.tsx`). */
  icon?: CollectionIconName;
  description?: string;
  /**
   * Per-operation access control for the generated REST API.
   * `read` defaults to `"public"`; `create`, `update` and `delete` default to
   * `"private"`.
   */
  access?: CollectionAccess;
  /**
   * A standalone collection holds exactly one record (no list view). The admin
   * edits the single item directly and the API exposes it at
   * the configured API path via `GET`/`PATCH`.
   */
  standalone?: boolean;
  /**
   * Locales this collection stores, in tab order (e.g. `["pt", "en"]`).
   * Drives the per-locale columns generated in the table. Defaults to the
   * global `defaultLocale` when omitted.
   */
  locales?: string[];
  /**
   * Ordered list of columns shown in the list view. Accepts field names plus
   * the special `id`, `createdAt` and `updatedAt`. When omitted, all fields
   * plus the managed timestamps are shown.
   */
  list?: string[];
  fields: FieldDef[];
};

export type SchemaDef = {
  title?: string;
  collections: CollectionDef[];
};

/** A single entry of a `media-list` field. */
export type MediaItem = {
  url: string;
  alt?: string;
  /** At most one item per list is the principal (cover/highlight). */
  primary?: boolean;
};

/** An ordered list of translated values, keyed by locale code. */
export type LocalizedValue = {
  [locale: string]: FieldValue;
};

/** Primitive value a field can hold. Relation values are numeric ids. */
export type FieldValue =
  | string
  | number
  | boolean
  | null
  | number[]
  | string[]
  | MediaItem[]
  | LocalizedValue;

/** An option shown by a relation control and used to render labels. */
export type RelationOption = {
  id: number;
  label: string;
};

/** Map of field name to its resolved relation options. */
export type RelationOptionsMap = Record<string, RelationOption[]>;

/** A persisted row plus the two managed timestamps. */
export type Item = {
  id: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: FieldValue | number;
};

export type ListResult = {
  items: Item[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/** Shape returned by the mutation endpoints. */
export type MutationResult = {
  item: Item;
};

import { getDefaultLocale } from "../locale.js";
import {
  getCmsConfig,
  getCollection as runtimeGetCollection,
  getCollections as runtimeGetCollections,
  localeLabel as runtimeLocaleLabel,
} from "../runtime.js";
import type { CollectionDef, FieldDef, FieldValue, LocalizedValue } from "./types.js";

/** Field types that are localized by default. */
const LOCALIZED_TYPES = new Set(["text", "textarea", "email", "list"]);

/** Locales stored by a collection (falls back to the global default). */
export function collectionLocales(collection: CollectionDef): string[] {
  return collection.locales && collection.locales.length > 0
    ? collection.locales
    : [getDefaultLocale()];
}

/** Whether a field is stored once per locale (`name_pt`, `name_en`). */
export function isLocalizedField(
  collection: CollectionDef,
  field: FieldDef,
): boolean {
  if (field.localized !== undefined) return field.localized;
  return LOCALIZED_TYPES.has(field.type);
}

/** Read the value of a (possibly localized) field for one locale. */
export function valueForLocale(
  collection: CollectionDef,
  field: FieldDef,
  item: Record<string, unknown>,
  locale: string = getDefaultLocale(),
): FieldValue {
  const raw = item[field.name];
  if (!isLocalizedField(collection, field)) return raw as FieldValue;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return (raw as LocalizedValue)[locale] ?? null;
}

export function getCollections(): CollectionDef[] {
  return runtimeGetCollections();
}

export function getCollection(slug: string): CollectionDef | undefined {
  return runtimeGetCollection(slug);
}

export function getSchemaTitle(): string {
  return getCmsConfig().title;
}

/** Admins can label locales passed from the host config. */
export function getLocaleLabel(code: string): string {
  return runtimeLocaleLabel(code);
}

/** Whether a collection holds exactly one record. */
export function isStandalone(collection: CollectionDef): boolean {
  return collection.standalone === true;
}

/** SQLite table name for a collection. */
export function tableName(slug: string): string {
  return `c_${slug.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

/** Whether a relation field stores a list of target ids. */
export function relationIsMany(field: FieldDef): boolean {
  return (
    field.type === "relation" &&
    field.relation?.type !== "one-to-one"
  );
}

/** Whether a relation field stores a single target id. */
export function relationIsOne(field: FieldDef): boolean {
  return field.type === "relation" && field.relation?.type === "one-to-one";
}

/** Default value for a single field. */
export function fieldDefault(field: FieldDef): FieldValue {
  if (field.defaultValue !== undefined) return field.defaultValue;
  switch (field.type) {
    case "boolean":
      return false;
    case "number":
      return field.min ?? 0;
    case "relation":
      return relationIsMany(field) ? [] : null;
    case "media-list":
      return [];
    case "list":
      return [];
    case "select":
      return field.options?.[0]?.value ?? "";
    default:
      return "";
  }
}

/** Empty record of values for a collection (used by the create form). */
export function emptyValues(collection: CollectionDef): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  const locales = collectionLocales(collection);
  for (const field of collection.fields) {
    const fallback = fieldDefault(field);
    values[field.name] = isLocalizedField(collection, field)
      ? Object.fromEntries(locales.map((locale) => [locale, fallback]))
      : fallback;
  }
  return values;
}

/** Human label used when showing a single item (e.g. delete confirmation). */
export function itemLabel(collection: CollectionDef, item: Record<string, unknown>): string {
  const preferred = collection.fields.find((field) => field.type === "text");
  const candidates = preferred ? [preferred, ...collection.fields] : collection.fields;

  for (const field of candidates) {
    const value = valueForLocale(collection, field, item);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return `#${String(item.id ?? "")}`;
}

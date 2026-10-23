import {
  collectionLocales,
  fieldDefault,
  isLocalizedField,
  relationIsMany,
} from "./schema.js";
import { isMediaUrl } from "./media.js";
import type {
  CollectionDef,
  FieldDef,
  FieldValue,
  LocalizedValue,
  MediaItem,
} from "./types.js";

export type ValidationResult = {
  ok: boolean;
  values: Record<string, FieldValue>;
  errors: Record<string, string>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asRecord(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

function coerceField(
  field: FieldDef,
  raw: unknown,
): { value: FieldValue } | { error: string } {
  switch (field.type) {
    case "boolean": {
      const value =
        raw === true || raw === "true" || raw === 1 || raw === "1";
      return { value };
    }
    case "number": {
      if (raw === "" || raw === null || raw === undefined) {
        if (field.required) return { error: "Campo obrigatório." };
        return { value: field.type === "number" ? (field.min ?? 0) : 0 };
      }
      const value = Number(raw);
      if (Number.isNaN(value)) return { error: "Número inválido." };
      if (field.min !== undefined && value < field.min) {
        return { error: `Valor mínimo: ${field.min}.` };
      }
      if (field.max !== undefined && value > field.max) {
        return { error: `Valor máximo: ${field.max}.` };
      }
      return { value };
    }
    case "select": {
      const value = raw === null || raw === undefined ? "" : String(raw);
      if (!value) {
        if (field.required) return { error: "Selecione uma opção." };
        return { value: "" };
      }
      const allowed = (field.options ?? []).map((option) => option.value);
      if (!allowed.includes(value)) return { error: "Opção inválida." };
      return { value };
    }
    case "relation": {
      const toId = (entry: unknown): number | null => {
        const source =
          entry && typeof entry === "object" && "id" in entry
            ? (entry as { id: unknown }).id
            : entry;
        const id = Number(source);
        return Number.isInteger(id) && id > 0 ? id : null;
      };

      if (relationIsMany(field)) {
        const list = Array.isArray(raw)
          ? raw
          : typeof raw === "string" && raw.trim()
            ? raw.split(",")
            : [];
        const ids = Array.from(
          new Set(list.map(toId).filter((id): id is number => id !== null)),
        );
        if (field.required && ids.length === 0) {
          return { error: "Selecione ao menos um item." };
        }
        return { value: ids };
      }

      if (raw === "" || raw === null || raw === undefined) {
        if (field.required) return { error: "Selecione um item." };
        return { value: null };
      }
      const id = toId(raw);
      if (id === null) return { error: "Relacionamento inválido." };
      return { value: id };
    }
    case "media": {
      const value = raw === null || raw === undefined ? "" : String(raw).trim();
      if (!value) {
        if (field.required) return { error: "Campo obrigatório." };
        return { value: "" };
      }
      if (!isMediaUrl(value)) {
        return { error: "Arquivo inválido." };
      }
      return { value };
    }
    case "media-list": {
      const list = Array.isArray(raw) ? raw : [];
      const media: MediaItem[] = [];
      let primarySeen = false;
      for (const entry of list) {
        const record = (
          entry && typeof entry === "object"
            ? entry
            : { url: entry }
        ) as { url?: unknown; alt?: unknown; primary?: unknown };
        const url = String(record.url ?? "").trim();
        if (!url) continue;
        if (!isMediaUrl(url)) return { error: "Arquivo inválido." };
        const primary = Boolean(record.primary) && !primarySeen;
        if (primary) primarySeen = true;
        media.push({
          url,
          alt: typeof record.alt === "string" ? record.alt : "",
          primary,
        });
      }
      if (field.required && media.length === 0) {
        return { error: "Envie ao menos uma mídia." };
      }
      if (media.length > 0 && !primarySeen) media[0]!.primary = true;
      return { value: media };
    }
    case "list": {
      const source = Array.isArray(raw)
        ? raw
        : typeof raw === "string" && raw.trim()
          ? raw.split("\n")
          : [];
      const items = source.map((entry) => String(entry).trim()).filter(Boolean);
      if (field.required && items.length === 0) {
        return { error: "Adicione ao menos um item." };
      }
      return { value: items };
    }
    case "email": {
      const value = raw === null || raw === undefined ? "" : String(raw).trim();
      if (!value) {
        if (field.required) return { error: "Campo obrigatório." };
        return { value: "" };
      }
      if (!EMAIL_RE.test(value)) return { error: "E-mail inválido." };
      return { value };
    }
    default: {
      const value = raw === null || raw === undefined ? "" : String(raw).trim();
      if (!value && field.required) return { error: "Campo obrigatório." };
      return { value };
    }
  }
}

/**
 * Validate and coerce a raw body into storable values.
 *
 * - `partial: false` (create): every field is resolved, falling back to its
 *   default when absent.
 * - `partial: true` (update): only keys present in the body are touched.
 */
export function coerceInput(
  collection: CollectionDef,
  input: unknown,
  { partial }: { partial: boolean },
): ValidationResult {
  const body = asRecord(input);
  const values: Record<string, FieldValue> = {};
  const errors: Record<string, string> = {};

  for (const field of collection.fields) {
    const present = Object.prototype.hasOwnProperty.call(body, field.name);
    if (partial && !present) continue;

    if (isLocalizedField(collection, field)) {
      const rawObject = asRecord(present ? body[field.name] : {});
      const value: LocalizedValue = {};
      for (const locale of collectionLocales(collection)) {
        const hasLocale = Object.prototype.hasOwnProperty.call(rawObject, locale);
        if (partial && present && !hasLocale) continue;
        const fallback = fieldDefault(field);
        const raw = hasLocale ? rawObject[locale] : fallback;
        const result = coerceField(field, raw);
        if ("error" in result) {
          errors[`${field.name}_${locale}`] = result.error;
        } else {
          value[locale] = result.value as string | string[];
        }
      }
      values[field.name] = value;
      continue;
    }

    const raw = present ? body[field.name] : fieldDefault(field);
    const result = coerceField(field, raw);
    if ("error" in result) {
      errors[field.name] = result.error;
    } else {
      values[field.name] = result.value;
    }
  }

  return { ok: Object.keys(errors).length === 0, values, errors };
}

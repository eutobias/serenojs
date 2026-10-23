/**
 * Public configuration surface of the CMS package.
 *
 * `serenojs.config.ts` in the host project is the single source of truth for
 * collections, locales and every mount path. Nothing inside the package may
 * import host code (`@/schemas`) directly — everything is read through
 * `runtime.ts`, configured once by `createCmsMiddleware`.
 */
import type {
  CollectionDef,
  CollectionIconName,
  FieldDef,
  FieldValue,
  Item,
  ListResult,
  MediaItem,
  RelationOptionsMap,
} from "./core/types.js";

export type { CollectionDef, CollectionIconName, FieldDef, FieldValue, Item, ListResult, MediaItem, RelationOptionsMap };

/** A locale known to the admin UI. */
export type LocaleDef = {
  code: string;
  label: string;
};

export type CmsAdminOptions = {
  /** Mount path for the admin SPA. Default: `/admin`. */
  path?: string;
  /** When `false`, the admin SPA and its assets answer `404`. */
  enabled?: boolean;
  /** Emit `X-Robots-Tag: noindex, nofollow` on admin responses. */
  noindex?: boolean;
};

export type CmsConfig = {
  /** Title shown in the admin UI. */
  title?: string;
  collections: CollectionDef[];
  /** Locale registry shown in the admin tabs. */
  locales?: LocaleDef[];
  /** Fallback locale. Default: `pt`. */
  defaultLocale?: string;
  admin?: CmsAdminOptions;
  api?: { path?: string };
  auth?: { path?: string };
  media?: { path?: string };
  files?: { path?: string };
  backup?: {
    path?: string;
    enabled?: boolean;
    intervalHours?: number;
    keep?: number;
  };
  db?: { path?: string };
};

export type ResolvedCmsConfig = {
  title: string;
  collections: CollectionDef[];
  locales: LocaleDef[];
  defaultLocale: string;
  admin: { path: string; enabled: boolean; noindex: boolean };
  api: { path: string };
  auth: { path: string };
  media: { path: string };
  files: { path: string };
  backup: {
    path: string;
    enabled: boolean;
    intervalHours: number;
    keep: number;
  };
  db: { path: string };
};

export const DEFAULT_LOCALES: LocaleDef[] = [
  { code: "pt", label: "Português" },
  { code: "en", label: "English" },
];

function mount(value: string | undefined, fallback: string): string {
  const raw = (value ?? fallback).trim() || fallback;
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
}

/** Normalize a user-supplied config into the shape used at runtime. */
export function resolveCmsConfig(config: CmsConfig): ResolvedCmsConfig {
  const locales =
    config.locales && config.locales.length > 0 ? config.locales : DEFAULT_LOCALES;
  return {
    title: config.title ?? "SerenoJS",
    collections: config.collections,
    locales,
    defaultLocale: config.defaultLocale ?? "pt",
    admin: {
      path: mount(config.admin?.path, "/admin"),
      enabled: config.admin?.enabled !== false,
      noindex: config.admin?.noindex !== false,
    },
    api: { path: mount(config.api?.path, "/api") },
    auth: { path: mount(config.auth?.path, "/auth") },
    media: { path: mount(config.media?.path, "/media") },
    files: { path: mount(config.files?.path, "/files") },
    backup: {
      path: mount(config.backup?.path, "/backup"),
      enabled: config.backup?.enabled !== false,
      intervalHours: config.backup?.intervalHours ?? 24,
      keep: config.backup?.keep ?? 10,
    },
    db: { path: config.db?.path ?? ".data/admin.db" },
  };
}

/** Identity helper for editor autocomplete in `serenojs.config.ts`. */
export function defineCmsConfig(config: CmsConfig): CmsConfig {
  return config;
}

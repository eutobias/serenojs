/**
 * Process-wide runtime configuration.
 *
 * Server code must never import the host project's schemas directly. The
 * middleware calls `configureCms(config)` once at boot and every module reads
 * the resolved config through these helpers.
 */
import { setDefaultLocale } from "./locale.js";
import {
  resolveCmsConfig,
  type CmsConfig,
  type CollectionDef,
  type ResolvedCmsConfig,
} from "./config.js";

let current: ResolvedCmsConfig | null = null;

export function configureCms(config: CmsConfig): ResolvedCmsConfig {
  current = resolveCmsConfig(config);
  setDefaultLocale(current.defaultLocale);
  return current;
}

export function isCmsConfigured(): boolean {
  return current !== null;
}

export function getCmsConfig(): ResolvedCmsConfig {
  if (!current) {
    throw new Error(
      "[serenojs] Runtime config is missing. Call createCmsMiddleware(config) from src/middleware/serenojs.ts.",
    );
  }
  return current;
}

export function getCollections(): CollectionDef[] {
  return getCmsConfig().collections;
}

export function getCollection(slug: string): CollectionDef | undefined {
  return getCollections().find((collection) => collection.slug === slug);
}

export function defaultLocale(): string {
  return getCmsConfig().defaultLocale;
}

export function localeLabel(code: string): string {
  return (
    getCmsConfig().locales.find((locale) => locale.code === code)?.label ??
    code.toUpperCase()
  );
}

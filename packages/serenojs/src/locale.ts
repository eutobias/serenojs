/**
 * Locale fallback shared by server and client code.
 *
 * Kept separate from `runtime.ts` so isomorphic helpers (schema labels, forms)
 * can use the configured default locale without pulling the server runtime into
 * the admin bundle.
 */
let defaultLocaleCode = "pt";

export function setDefaultLocale(code: string): void {
  defaultLocaleCode = code;
}

export function getDefaultLocale(): string {
  return defaultLocaleCode;
}

import type { LocaleDef } from "../../config.js";

let labels = new Map<string, string>();

/** Injected once by the admin SPA bootstrap. */
export function setLocaleLabels(locales: LocaleDef[]): void {
  labels = new Map(locales.map((locale) => [locale.code, locale.label]));
}

export function localeLabel(code: string): string {
  return labels.get(code) ?? code.toUpperCase();
}

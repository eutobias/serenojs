/**
 * Locale registry for the i18n layer.
 *
 * The registry only provides display labels for the admin tabs. Which locales
 * a collection actually stores is declared per collection via
 * `CollectionDef.locales`; this array is the allowed set.
 */

export type LocaleDef = {
  code: string;
  label: string;
};

export const locales: LocaleDef[] = [
  { code: "pt", label: "Português" },
  { code: "en", label: "English" },
];

/** Locale used as fallback and for the seed of legacy single-column data. */
export const defaultLocale = "pt";

/** Display label for a locale code (falls back to the uppercased code). */
export function localeLabel(code: string): string {
  return (
    locales.find((locale) => locale.code === code)?.label ?? code.toUpperCase()
  );
}

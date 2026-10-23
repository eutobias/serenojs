import type { CollectionDef } from "@eutobias/serenojs/config";

import { todos } from "./todos";

export { defaultLocale, localeLabel, locales } from "./locales";
export type { LocaleDef } from "./locales";

/** Title shown across the admin panel. */
export const schemaTitle = "SerenoJS";

/**
 * Every collection available in the admin/API.
 *
 * To add a new collection: create a `<name>.ts` file in this folder exporting
 * a `CollectionDef` and register it in the array below.
 */
export const collections: CollectionDef[] = [todos];

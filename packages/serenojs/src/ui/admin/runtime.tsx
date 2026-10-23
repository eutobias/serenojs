"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { CollectionDef, LocaleDef } from "../../config.js";

/** Payload injected into the admin shell by the server (no secrets). */
export type AdminRuntimeConfig = {
  title: string;
  adminPath: string;
  apiPath: string;
  authPath: string;
  mediaPath: string;
  filesPath: string;
  backupPath: string;
  collections: CollectionDef[];
  locales: LocaleDef[];
  defaultLocale: string;
};

const RuntimeContext = createContext<AdminRuntimeConfig | null>(null);

export function AdminRuntimeProvider({
  value,
  children,
}: {
  value: AdminRuntimeConfig;
  children: ReactNode;
}) {
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useCms(): AdminRuntimeConfig {
  const value = useContext(RuntimeContext);
  if (!value) {
    throw new Error("[serenojs] AdminRuntimeProvider is missing.");
  }
  return value;
}

/** Join a mount path and a relative segment without double slashes. */
export function joinPath(base: string, segment: string): string {
  if (!segment) return base;
  return `${base.replace(/\/+$/, "")}/${segment.replace(/^\/+/, "")}`;
}

export function useCmsUrls() {
  const config = useCms();
  return useMemo(
    () => ({
      api: (path: string) => joinPath(config.apiPath, path),
      auth: (path: string) => joinPath(config.authPath, path),
      media: (query = "") => `${config.mediaPath}${query ? `?${query}` : ""}`,
      backup: (query = "") => `${config.backupPath}${query ? `?${query}` : ""}`,
    }),
    [config.apiPath, config.authPath, config.mediaPath, config.backupPath],
  );
}

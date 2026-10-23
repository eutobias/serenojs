"use client";

import { Link, useRouter } from "./router.js";

import type { CollectionDef } from "../../core/types.js";
import type { AuthUser } from "../../auth/config.js";
import { Box } from "../box.js";
import { Button } from "../button.js";
import { Text } from "../text.js";
import { FiDatabase, FiUsers } from "react-icons/fi";
import { CollectionIcon } from "./collection-icon.js";
import { ADMIN_LOCALES, useI18n } from "./i18n.js";

export type SidebarProps = {
  title: string;
  collections: CollectionDef[];
  user?: AuthUser;
  onLogout?: () => void;
  onNavigate?: () => void;
};

/**
 * Left navigation derived from the schema descriptor.
 */
export const Sidebar = ({
  title,
  collections,
  user,
  onLogout,
  onNavigate,
}: SidebarProps) => {
  const { path } = useRouter();
  const { t, locale, setLocale } = useI18n();

  return (
    <Box
      as="aside"
      className="sticky top-0 h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white"
    >
      <Box className="flex-col gap-1 border-b border-gray-200 px-5 py-5">
        <Text size="caption" className="font-semibold uppercase tracking-widest text-gray-400">
          {title}
        </Text>
        <Text size="caption" className="text-gray-400">
          Admin
        </Text>
      </Box>

      <Box className="flex-1 flex-col gap-1 p-3">
        <Text
          size="caption"
          className="px-2 pb-1 pt-2 font-semibold uppercase tracking-wide text-gray-400"
        >
          {t("sidebar.collections")}
        </Text>
        <Link
          to="/"
          onClick={onNavigate}
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
            path === "/"
              ? "bg-gray-900 font-medium text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <span aria-hidden>▦</span>
          <span>{t("sidebar.overview")}</span>
        </Link>
        {collections.map((collection) => {
          const href = `/${collection.slug}`;
          const active = path === href || path.startsWith(`${href}/`);
          return (
            <Link
              key={collection.slug}
              to={href}
              onClick={onNavigate}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-gray-900 font-medium text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <CollectionIcon
                name={collection.icon}
                className="h-4 w-4 shrink-0"
              />
              <span>{collection.label}</span>
              {collection.standalone ? (
                <span
                  aria-hidden
                  title={t("sidebar.singleRecord")}
                  className={`ml-auto h-1.5 w-1.5 rounded-full ${
                    active ? "bg-white/70" : "bg-gray-300"
                  }`}
                />
              ) : null}
            </Link>
          );
        })}

        <Text
          size="caption"
          className="px-2 pb-1 pt-4 font-semibold uppercase tracking-wide text-gray-400"
        >
          {t("sidebar.administration")}
        </Text>
        <Link
          to="/users"
          onClick={onNavigate}
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
            path === "/users"
              ? "bg-gray-900 font-medium text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <FiUsers aria-hidden className="h-4 w-4 shrink-0" />
          <span>{t("sidebar.users")}</span>
        </Link>
        <Link
          to="/backup"
          onClick={onNavigate}
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
            path === "/backup"
              ? "bg-gray-900 font-medium text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <FiDatabase aria-hidden className="h-4 w-4 shrink-0" />
          <span>{t("sidebar.backup")}</span>
        </Link>
      </Box>

      <Box className="flex-col gap-1 border-t border-gray-200 p-3">
        <Text size="caption" className="px-2 font-semibold uppercase tracking-wide text-gray-400">
          {t("common.language")}
        </Text>
        <select
          value={locale}
          onChange={(event) => setLocale(event.target.value === "pt" ? "pt" : "en")}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          aria-label={t("common.language")}
        >
          {ADMIN_LOCALES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </Box>

      {user ? (
        <Box className="flex-col gap-2 border-t border-gray-200 p-3">
          <Box className="flex-col px-2">
            <Text
              size="caption"
              className="truncate font-medium text-gray-700"
              title={user.email}
            >
              {user.email}
            </Text>
            <Text size="caption" className="text-gray-400">
              {t("sidebar.sessionActive")}
            </Text>
          </Box>
          {onLogout ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onLogout}
            >
              {t("sidebar.signOut")}
            </Button>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
};

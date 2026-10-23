import type { ReactNode } from "react";

import { relationIsMany } from "../../core/schema.js";
import { isImageUrl } from "../../core/media.js";
import type { FieldDef, FieldValue, MediaItem, RelationOption } from "../../core/types.js";
import { Badge } from "../badge.js";
import { Box } from "../box.js";
import { Text } from "../text.js";
import type { AdminLocale } from "./i18n.js";
import { translate } from "./i18n.js";

function labelFor(options: RelationOption[], id: number): string {
  return options.find((option) => option.id === id)?.label ?? `#${id}`;
}

/**
 * Turns a stored value into a presentational node for tables.
 */
export function renderFieldValue(
  field: FieldDef,
  value: FieldValue,
  options: RelationOption[] = [],
  locale: AdminLocale = "en",
): ReactNode {
  if (field.type === "boolean") {
    return <Badge tone={value ? "green" : "gray"}>{value ? translate(locale, "common.yes") : translate(locale, "common.no")}</Badge>;
  }

  if (field.type === "select") {
    const option = field.options?.find((entry) => entry.value === value);
    return <Badge tone="blue">{option?.label ?? String(value ?? "—")}</Badge>;
  }

  if (field.type === "media") {
    if (value === null || value === undefined || value === "") {
      return <Text as="span" size="caption" className="text-gray-300">—</Text>;
    }
    const url = String(value);
    if (isImageUrl(url)) {
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          src={url}
          alt=""
          className="h-10 w-16 rounded border border-gray-200 object-cover"
        />
      );
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="truncate text-sm text-gray-600 underline hover:text-gray-900"
      >
        {url.split("/").pop() ?? url}
      </a>
    );
  }

  if (field.type === "list") {
    const items = Array.isArray(value) ? (value as string[]) : [];
    if (items.length === 0) {
      return <Text as="span" size="caption" className="text-gray-300">—</Text>;
    }
    return (
      <Box className="flex-wrap items-center gap-1">
        {items.slice(0, 2).map((item, index) => (
          <Badge key={`${item}-${index}`} tone="gray">
            {item}
          </Badge>
        ))}
        {items.length > 2 ? <Badge tone="gray">+{items.length - 2}</Badge> : null}
      </Box>
    );
  }

  if (field.type === "media-list") {
    const items = Array.isArray(value) ? (value as MediaItem[]) : [];
    if (items.length === 0) {
      return <Text as="span" size="caption" className="text-gray-300">—</Text>;
    }
    return (
      <Box className="items-center gap-1">
        {items.slice(0, 2).map((item, index) =>
          isImageUrl(item.url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${item.url}-${index}`}
              src={item.url}
              alt={item.alt ?? ""}
              className="h-10 w-16 rounded border border-gray-200 object-cover"
            />
          ) : null,
        )}
        {items.length > 2 ? <Badge tone="gray">+{items.length - 2}</Badge> : null}
      </Box>
    );
  }

  if (field.type === "relation") {
    if (relationIsMany(field)) {
      const ids = Array.isArray(value) ? (value as number[]) : [];
      if (ids.length === 0) return <Text as="span" size="caption" className="text-gray-300">—</Text>;
      const visible = ids.slice(0, 2);
      const rest = ids.length - visible.length;
      return (
        <Box className="items-center gap-1">
          {visible.map((id) => (
            <Badge key={id} tone="amber">
              {labelFor(options, id)}
            </Badge>
          ))}
          {rest > 0 ? <Badge tone="gray">+{rest}</Badge> : null}
        </Box>
      );
    }

    if (value === null || value === undefined || value === "") {
      return <Text as="span" size="caption" className="text-gray-300">—</Text>;
    }
    return <Badge tone="amber">{labelFor(options, Number(value))}</Badge>;
  }

  if (value === null || value === undefined || value === "") {
    return (
      <Text as="span" size="caption" className="text-gray-300">
        —
      </Text>
    );
  }

  return (
    <Text as="span" size="caption" className="block truncate text-gray-700">
      {String(value)}
    </Text>
  );
}

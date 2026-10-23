"use client";

import { useCallback, useEffect, useState } from "react";

import { itemLabel, valueForLocale } from "../../core/schema.js";
import type {
  CollectionDef,
  FieldDef,
  FieldValue,
  Item,
  ListResult,
  RelationOptionsMap,
} from "../../core/types.js";
import { Badge } from "../badge.js";
import { Box } from "../box.js";
import { Button, IconButton } from "../button.js";
import { Drawer } from "../drawer.js";
import { Text } from "../text.js";
import { FiEdit2, FiTrash2 } from "react-icons/fi";

import { renderFieldValue } from "./display.js";
import { ItemForm } from "./item-form.js";
import { Pagination } from "./pagination.js";
import { DataTable, type Column } from "./table.js";
import { useToast } from "./toast.js";
import { useI18n } from "./i18n.js";
import { useCmsUrls } from "./runtime.js";

export type CollectionManagerProps = {
  collection: CollectionDef;
  initial: ListResult;
  relationOptions: RelationOptionsMap;
};

type DrawerState =
  | { kind: "closed" }
  | { kind: "form"; item: Item | null }
  | { kind: "delete"; item: Item };

const LIMIT = 10;

/** Deterministic (UTC) date format to avoid SSR/client hydration mismatches. */
function formatDateTime(value: unknown, locale: "en" | "pt"): string {
  if (typeof value !== "string" || !value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const date = locale === "en" ? `${match[2]}/${match[3]}/${match[1]}` : `${match[3]}/${match[2]}/${match[1]}`;
  return `${date} ${match[4]}:${match[5]}`;
}

export const CollectionManager = ({
  collection,
  initial,
  relationOptions,
}: CollectionManagerProps) => {
  const [data, setData] = useState<ListResult>(initial);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<DrawerState>({ kind: "closed" });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();
  const { api } = useCmsUrls();
  const { t, locale } = useI18n();

  // Reset local state whenever the collection changes so navigating between
  // models never shows stale data.
  useEffect(() => {
    setData(initial);
    setQuery("");
    setSearch("");
    setDrawer({ kind: "closed" });
    setErrors({});
    setFormError(null);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection.slug]);

  const load = useCallback(
    async (nextPage: number, nextSearch: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: String(LIMIT),
          q: nextSearch,
        });
        const response = await fetch(
          `${api(collection.slug)}?${params.toString()}`,
        );
        if (!response.ok) throw new Error(t("collection.loadError"));
        const json = (await response.json()) as ListResult;
        setData(json);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("app.unexpected"));
      } finally {
        setLoading(false);
      }
    },
    [collection.slug, toast],
  );

  const closeDrawer = useCallback(() => {
    setDrawer({ kind: "closed" });
    setErrors({});
    setFormError(null);
  }, []);

  const openCreate = () => {
    setErrors({});
    setFormError(null);
    setDrawer({ kind: "form", item: null });
  };

  const openEdit = (item: Item) => {
    setErrors({});
    setFormError(null);
    setDrawer({ kind: "form", item });
  };

  const openDelete = (item: Item) => {
    setErrors({});
    setFormError(null);
    setDrawer({ kind: "delete", item });
  };

  const submitForm = async (values: Record<string, FieldValue>) => {
    if (drawer.kind !== "form") return;
    const editing = drawer.item;
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      const response = await fetch(
        editing
          ? api(`${collection.slug}/${editing.id}`)
          : api(collection.slug),
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const json = (await response.json()) as {
        message?: string;
        errors?: Record<string, string>;
      };
      if (!response.ok) {
        setErrors(json.errors ?? {});
        setFormError(json.message ?? t("collection.saveError"));
        return;
      }
      closeDrawer();
      toast.success(
        editing ? t("collection.updated") : t("collection.created"),
      );
      await load(editing ? data.page : 1, search);
    } catch {
      setFormError(t("collection.networkSave"));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (drawer.kind !== "delete") return;
    setSubmitting(true);
    try {
      const response = await fetch(
        api(`${collection.slug}/${drawer.item.id}`),
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error(t("collection.removeError"));
      closeDrawer();
      toast.success(t("collection.removed"));
      await load(data.page, search);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("app.unexpected"));
    } finally {
      setSubmitting(false);
    }
  };

  const fieldColumn = (field: FieldDef): Column<Item> => ({
    key: field.name,
    header: field.label,
    render: (row: Item) =>
      renderFieldValue(
        field,
        valueForLocale(collection, field, row),
        relationOptions[field.name] ?? [],
      ),
  });

  const idColumn: Column<Item> = {
    key: "id",
    header: "ID",
    width: "70px",
    render: (row) => (
      <Text as="span" size="caption" className="text-gray-400">
        #{row.id}
      </Text>
    ),
  };
  const createdAtColumn: Column<Item> = {
    key: "createdAt",
    header: t("common.createdAt"),
    width: "150px",
    render: (row: Item) => (
      <Text as="span" size="caption" className="whitespace-nowrap text-gray-500">
        {formatDateTime(row.createdAt, locale)}
      </Text>
    ),
  };
  const updatedAtColumn: Column<Item> = {
    key: "updatedAt",
    header: t("common.updatedAt"),
    width: "150px",
    render: (row: Item) => (
      <Text as="span" size="caption" className="whitespace-nowrap text-gray-500">
        {formatDateTime(row.updatedAt, locale)}
      </Text>
    ),
  };
  const actionsColumn: Column<Item> = {
    key: "__actions",
    header: "",
    width: "110px",
    align: "right",
    render: (row: Item) => (
      <Box className="items-center justify-end gap-1">
        <IconButton type="button" label="Editar" onClick={() => openEdit(row)}>
          <FiEdit2 aria-hidden />
        </IconButton>
        <IconButton
          type="button"
          label="Remover"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => openDelete(row)}
        >
          <FiTrash2 aria-hidden />
        </IconButton>
      </Box>
    ),
  };

  const fieldsByName = new Map(collection.fields.map((field) => [field.name, field]));
  const configuredColumns =
    collection.list && collection.list.length > 0
      ? collection.list
      : [
          "id",
          ...collection.fields.map((field) => field.name),
          "createdAt",
          "updatedAt",
        ];

  const columns: Column<Item>[] = [
    ...configuredColumns.flatMap<Column<Item>>((name) => {
      if (name === "id") return [idColumn];
      if (name === "createdAt") return [createdAtColumn];
      if (name === "updatedAt") return [updatedAtColumn];
      const field = fieldsByName.get(name);
      return field ? [fieldColumn(field)] : [];
    }),
    actionsColumn,
  ];

  return (
    <Box className="flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Box className="flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
        <Box className="flex-col gap-1">
          <Box className="items-center gap-3">
            <Text size="title" className="font-semibold text-gray-900">
              {collection.label}
            </Text>
            <Badge tone="gray">{data.total}</Badge>
          </Box>
          {collection.description ? (
            <Text size="caption" className="text-gray-500">
              {collection.description}
            </Text>
          ) : null}
        </Box>
        <Button type="button" variant="primary" onClick={openCreate}>
          {t("collection.newItem")}
        </Button>
      </Box>

      <Box className="flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Box
          as="form"
          className="items-stretch gap-2 flex-row sm:items-center"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(query);
            void load(1, query);
          }}
        >
          <input
            type="search"
            value={query}
            placeholder={t("collection.searchPlaceholder")}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 sm:w-64"
          />
          <Box className="items-center gap-2">
            <Button type="submit" variant="secondary" size="sm">
              {t("common.search")}
            </Button>
            {search ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setSearch("");
                  void load(1, "");
                }}
              >
                {t("common.clear")}
              </Button>
            ) : null}
          </Box>
        </Box>
      </Box>

      <DataTable
        columns={columns}
        rows={data.items}
        rowKey={(row) => row.id}
        loading={loading}
        empty={t("collection.empty")}
      />

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        limit={data.limit}
        onPage={(next) => void load(next, search)}
      />

      <Drawer
        open={drawer.kind !== "closed"}
        onClose={closeDrawer}
        title={
          drawer.kind === "form"
            ? drawer.item
              ? t("collection.editTitle", { id: drawer.item.id })
              : t("collection.newTitle", { label: collection.label })
            : t("collection.removeTitle")
        }
        description={
          drawer.kind === "delete"
            ? t("common.deleteWarning")
            : undefined
        }
        width={drawer.kind === "form" ? "lg" : "md"}
      >
        {drawer.kind === "form" ? (
          <ItemForm
            key={drawer.item ? drawer.item.id : "new"}
            collection={collection}
            item={drawer.item}
            submitting={submitting}
            errors={errors}
            formError={formError}
            relationOptions={relationOptions}
            onSubmit={submitForm}
            onCancel={closeDrawer}
          />
        ) : null}

        {drawer.kind === "delete" ? (
          <Box className="flex-col gap-6">
            <Box className="flex-col gap-2">
              <Text className="text-gray-700">
                {t("collection.removeConfirm", { label: itemLabel(collection, drawer.item) })}
              </Text>
            </Box>
            <Box className="items-center justify-end gap-2 border-t border-gray-200 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={closeDrawer}
                disabled={submitting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => void confirmDelete()}
                disabled={submitting}
              >
                {submitting ? t("common.removing") : t("common.remove")}
              </Button>
            </Box>
          </Box>
        ) : null}
      </Drawer>
    </Box>
  );
};

"use client";

import { useState } from "react";

import type {
  CollectionDef,
  FieldValue,
  Item,
  RelationOptionsMap,
} from "../../core/types.js";
import { Badge } from "../badge.js";
import { Box } from "../box.js";
import { Text } from "../text.js";

import { ItemForm } from "./item-form.js";
import { useToast } from "./toast.js";
import { useI18n } from "./i18n.js";
import { useCmsUrls } from "./runtime.js";

export type StandaloneManagerProps = {
  collection: CollectionDef;
  initial: Item;
  relationOptions: RelationOptionsMap;
};

/**
 * Editor for a standalone collection: no table, no create/delete — just the
 * single record rendered as a form.
 */
export const StandaloneManager = ({
  collection,
  initial,
  relationOptions,
}: StandaloneManagerProps) => {
  const toast = useToast();
  const { api } = useCmsUrls();
  const { t } = useI18n();
  const [item, setItem] = useState<Item>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (values: Record<string, FieldValue>) => {
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      const response = await fetch(api(collection.slug), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = (await response.json()) as {
        item?: Item;
        message?: string;
        errors?: Record<string, string>;
      };
      if (!response.ok) {
        setErrors(json.errors ?? {});
        setFormError(json.message ?? t("standalone.saveError"));
        return;
      }
      if (json.item) setItem(json.item);
      toast.success(t("standalone.saved"));
    } catch {
      setFormError(t("standalone.networkSave"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box className="flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Box className="flex-col gap-1">
        <Box className="items-center gap-3">
          <Text size="title" className="font-semibold text-gray-900">
            {collection.label}
          </Text>
          <Badge tone="purple">{t("standalone.badge")}</Badge>
        </Box>
        {collection.description ? (
          <Text size="caption" className="text-gray-500">
            {collection.description}
          </Text>
        ) : null}
      </Box>

      <Box className="max-w-2xl flex-col rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <ItemForm
          key={collection.slug}
          collection={collection}
          item={item}
          submitting={submitting}
          errors={errors}
          formError={formError}
          relationOptions={relationOptions}
          onSubmit={submit}
          hideCancel
        />
      </Box>
    </Box>
  );
};

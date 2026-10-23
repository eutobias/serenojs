"use client";

import { useState } from "react";

import { collectionLocales, emptyValues, isLocalizedField } from "../../core/schema.js";
import { localeLabel } from "./locales.js";
import type {
  CollectionDef,
  FieldDef,
  FieldValue,
  Item,
  LocalizedValue,
  RelationOptionsMap,
} from "../../core/types.js";
import { Box } from "../box.js";
import { Button } from "../button.js";
import { Text } from "../text.js";
import { FieldControl } from "./field-control.js";
import { useI18n } from "./i18n.js";

export type ItemFormProps = {
  collection: CollectionDef;
  item: Item | null;
  submitting: boolean;
  errors: Record<string, string>;
  formError: string | null;
  relationOptions: RelationOptionsMap;
  onSubmit: (values: Record<string, FieldValue>) => void;
  onCancel?: () => void;
  /** Hide the cancel button (e.g. standalone records, where there is no list to return to). */
  hideCancel?: boolean;
};

function initialValues(
  collection: CollectionDef,
  item: Item | null,
): Record<string, FieldValue> {
  const base = emptyValues(collection);
  if (!item) return base;
  for (const field of collection.fields) {
    base[field.name] = item[field.name] ?? base[field.name] ?? null;
  }
  return base;
}

function asLocalized(value: FieldValue | undefined): LocalizedValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LocalizedValue)
    : {};
}

/**
 * Create/edit form rendered inside the drawer.
 *
 * Localized fields are shown in one tab per locale; language-independent fields
 * live in a "Geral" section below the tabs.
 */
export const ItemForm = ({
  collection,
  item,
  submitting,
  errors,
  formError,
  relationOptions,
  onSubmit,
  onCancel,
  hideCancel,
}: ItemFormProps) => {
  const { t } = useI18n();
  const locales = collectionLocales(collection);
  const localizedFields = collection.fields.filter((field) =>
    isLocalizedField(collection, field),
  );
  const sharedFields = collection.fields.filter(
    (field) => !isLocalizedField(collection, field),
  );
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    initialValues(collection, item),
  );
  const [locale, setLocale] = useState(locales[0] ?? "");

  const update = (name: string, value: FieldValue) => {
    setValues((previous) => ({ ...previous, [name]: value }));
  };

  const updateLocalized = (
    field: FieldDef,
    loc: string,
    value: FieldValue,
  ) => {
    setValues((previous) => ({
      ...previous,
      [field.name]: {
        ...asLocalized(previous[field.name]),
        [loc]: value,
      },
    }));
  };

  const renderField = (field: FieldDef, value: FieldValue, error?: string, onChange?: (v: FieldValue) => void) => (
    <FieldControl
      key={field.name}
      field={field}
      collectionSlug={collection.slug}
      value={value ?? null}
      error={error}
      disabled={submitting}
      relationOptions={relationOptions[field.name] ?? []}
      onChange={onChange ?? ((next) => update(field.name, next))}
    />
  );

  return (
    <Box
      as="form"
      className="flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      {formError ? (
        <Box className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <Text size="caption" className="text-red-700">
            {formError}
          </Text>
        </Box>
      ) : null}

      {localizedFields.length > 0 ? (
        <Box className="flex-col gap-5">
          <Box className="flex-wrap items-center gap-1 rounded-lg bg-gray-100 p-1">
            {locales.map((code) => {
              const active = code === locale;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {localeLabel(code)}
                </button>
              );
            })}
          </Box>

          {localizedFields.map((field) =>
            renderField(
              field,
              asLocalized(values[field.name])[locale] ?? null,
              errors[`${field.name}_${locale}`],
              (value) => updateLocalized(field, locale, value),
            ),
          )}
        </Box>
      ) : null}

      {sharedFields.length > 0 ? (
        <Box className="flex-col gap-5 border-t border-gray-200 pt-5">
          {localizedFields.length > 0 ? (
            <Text
              size="caption"
              className="font-semibold uppercase tracking-wide text-gray-400"
            >
              {t("form.general")}
            </Text>
          ) : null}
          {sharedFields.map((field) =>
            renderField(
              field,
              values[field.name] ?? null,
              errors[field.name],
            ),
          )}
        </Box>
      ) : null}

      <Box className="items-center justify-end gap-2 border-t border-gray-200 pt-4">
        {hideCancel ? null : (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? t("common.saving") : item ? t("common.saveChanges") : t("form.create")}
        </Button>
      </Box>
    </Box>
  );
};

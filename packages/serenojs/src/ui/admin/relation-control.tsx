"use client";

import type {
  FieldDef,
  FieldValue,
  RelationOption,
} from "../../core/types.js";
import { relationIsMany } from "../../core/schema.js";
import { Box } from "../box.js";
import { FieldWrapper, inputClass } from "../field-wrapper.js";
import { Text } from "../text.js";
import { useI18n } from "./i18n.js";

export type RelationControlProps = {
  field: FieldDef;
  value: FieldValue;
  options: RelationOption[];
  error?: string | undefined;
  disabled?: boolean | undefined;
  onChange: (value: FieldValue) => void;
};

/**
 * Renders a relation field: a `<select>` for singular relations, a scrollable
 * checkbox list for plural ones.
 */
export const RelationControl = ({
  field,
  value,
  options,
  error,
  disabled,
  onChange,
}: RelationControlProps) => {
  const { t } = useI18n();
  const id = `field-${field.name}`;
  const label = `${field.label} (${field.relation?.to ?? ""})`;
  const many = relationIsMany(field);

  return (
    <FieldWrapper
      label={label}
      htmlFor={id}
      required={field.required}
      help={field.help}
      error={error}
    >
      {many ? (
        <ManyControl
          id={id}
          disabled={disabled}
          options={options}
          selected={Array.isArray(value) ? (value as number[]) : []}
          onChange={onChange}
        />
      ) : (
        <select
          id={id}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(event) =>
            onChange(event.target.value === "" ? null : Number(event.target.value))
          }
          className={`${inputClass} ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300"
          }`}
        >
          <option value="">{t("field.none")}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldWrapper>
  );
};

type ManyControlProps = {
  id: string;
  disabled?: boolean | undefined;
  options: RelationOption[];
  selected: number[];
  onChange: (value: FieldValue) => void;
};

const ManyControl = ({
  id,
  disabled,
  options,
  selected,
  onChange,
}: ManyControlProps) => {
  const { t } = useI18n();
  const toggle = (optionId: number) => {
    const next = selected.includes(optionId)
      ? selected.filter((entry) => entry !== optionId)
      : [...selected, optionId];
    onChange(next);
  };

  return (
    <Box
      id={id}
      className={`max-h-44 flex-col gap-1 overflow-y-auto rounded-md border bg-white p-1.5 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      {options.length === 0 ? (
        <Text size="caption" className="px-2 py-3 text-gray-400">
          {t("relation.empty")}
        </Text>
      ) : (
        options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <Box
              as="label"
              key={option.id}
              className="cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(option.id)}
                className="h-4 w-4 cursor-pointer accent-gray-900"
              />
              <Text size="caption" className="text-gray-700">
                {option.label}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
};

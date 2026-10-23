import type { FieldDef, FieldValue, MediaItem, RelationOption } from "../../core/types.js";
import { Box } from "../box.js";
import { FieldWrapper, inputClass } from "../field-wrapper.js";
import { Text } from "../text.js";
import { MediaControl } from "./media-control.js";
import { MediaListControl } from "./media-list-control.js";
import { ListControl } from "./list-control.js";
import { RelationControl } from "./relation-control.js";
import { useI18n } from "./i18n.js";

export type FieldControlProps = {
  field: FieldDef;
  collectionSlug: string;
  value: FieldValue;
  error?: string | undefined;
  disabled?: boolean | undefined;
  relationOptions?: RelationOption[] | undefined;
  onChange: (value: FieldValue) => void;
};

/**
 * Renders a single descriptor field as the right input control.
 */
export const FieldControl = ({
  field,
  collectionSlug,
  value,
  error,
  disabled,
  relationOptions,
  onChange,
}: FieldControlProps) => {
  const { t } = useI18n();
  const id = `field-${field.name}`;

  if (field.type === "media") {
    return (
      <MediaControl
        field={field}
        collectionSlug={collectionSlug}
        value={typeof value === "string" ? value : ""}
        error={error}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (field.type === "media-list") {
    return (
      <MediaListControl
        field={field}
        collectionSlug={collectionSlug}
        value={Array.isArray(value) ? (value as MediaItem[]) : []}
        error={error}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (field.type === "list") {
    return (
      <ListControl
        field={field}
        value={Array.isArray(value) ? (value as string[]) : []}
        error={error}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (field.type === "relation") {
    return (
      <RelationControl
        field={field}
        value={value}
        options={relationOptions ?? []}
        error={error}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <Box className="items-start gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-gray-900"
        />
        <Box className="flex-col">
          <Text
            as="label"
            htmlFor={id}
            size="caption"
            className="cursor-pointer font-medium text-gray-800"
          >
            {field.label}
          </Text>
          {field.help ? (
            <Text size="caption" className="text-gray-400">
              {field.help}
            </Text>
          ) : null}
        </Box>
      </Box>
    );
  }

  const shared = {
    id,
    disabled,
    "aria-invalid": Boolean(error),
    className: `${inputClass} ${
      error ? "border-red-400 focus:border-red-500 focus:ring-red-500" : "border-gray-300"
    }`,
  };

  let control;
  switch (field.type) {
    case "textarea":
      control = (
        <textarea
          {...shared}
          rows={4}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    case "select":
      control = (
        <select
          {...shared}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{t("field.select")}</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
      break;
    case "number":
      control = (
        <input
          {...shared}
          type="number"
          min={field.min}
          max={field.max}
          value={value === null || value === undefined ? "" : String(value)}
          placeholder={field.placeholder}
          onChange={(event) =>
            onChange(event.target.value === "" ? "" : Number(event.target.value))
          }
        />
      );
      break;
    case "email":
      control = (
        <input
          {...shared}
          type="email"
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    case "date":
      control = (
        <input
          {...shared}
          type="date"
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    default:
      control = (
        <input
          {...shared}
          type="text"
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }

  return (
    <FieldWrapper
      label={field.label}
      htmlFor={id}
      required={field.required}
      help={field.help}
      error={error}
    >
      {control}
    </FieldWrapper>
  );
};

"use client";

import {
  FiArrowDown,
  FiArrowUp,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";

import type { FieldDef } from "../../core/types.js";
import { Box } from "../box.js";
import { Button, IconButton } from "../button.js";
import { FieldWrapper, inputClass } from "../field-wrapper.js";
import { Text } from "../text.js";
import { useI18n } from "./i18n.js";

export type ListControlProps = {
  field: FieldDef;
  value: string[];
  error?: string | undefined;
  disabled?: boolean | undefined;
  onChange: (value: string[]) => void;
};

/**
 * Native `list` widget: an ordered list of short text values (add, edit,
 * reorder, remove).
 */
export const ListControl = ({
  field,
  value,
  error,
  disabled,
  onChange,
}: ListControlProps) => {
  const { t } = useI18n();
  const update = (index: number, next: string) =>
    onChange(value.map((item, i) => (i === index ? next : item)));

  const remove = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const current = next[index];
    const swap = next[target];
    if (current === undefined || swap === undefined) return;
    next[index] = swap;
    next[target] = current;
    onChange(next);
  };

  return (
    <FieldWrapper
      label={field.label}
      required={field.required}
      help={field.help}
      error={error}
    >
      <Box className="flex-col gap-2">
        {value.length === 0 ? (
          <Text size="caption" className="text-gray-400">
            {t("list.empty")}
          </Text>
        ) : null}

        {value.map((item, index) => (
          <Box key={index} className="items-center gap-1.5">
            <Box className="min-w-0 flex-1">
              <input
                value={item}
                disabled={disabled}
                placeholder={t("list.item", { index: index + 1 })}
                onChange={(event) => update(index, event.target.value)}
                className={`${inputClass} border-gray-300`}
              />
            </Box>
            <IconButton
              type="button"
              label={t("list.moveUp")}
              disabled={disabled || index === 0}
              onClick={() => move(index, -1)}
            >
              <FiArrowUp aria-hidden />
            </IconButton>
            <IconButton
              type="button"
              label={t("list.moveDown")}
              disabled={disabled || index === value.length - 1}
              onClick={() => move(index, 1)}
            >
              <FiArrowDown aria-hidden />
            </IconButton>
            <IconButton
              type="button"
              label={t("list.remove")}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={disabled}
              onClick={() => remove(index)}
            >
              <FiTrash2 aria-hidden />
            </IconButton>
          </Box>
        ))}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...value, ""])}
        >
          <FiPlus aria-hidden className="mr-1.5" />
          {t("list.add")}
        </Button>
      </Box>
    </FieldWrapper>
  );
};

import type { ReactNode } from "react";

import { Box } from "./box.js";
import { Text } from "./text.js";

const inputClass =
  "w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500";

export type FieldWrapperProps = {
  label: string;
  htmlFor?: string | undefined;
  required?: boolean | undefined;
  help?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
};

/**
 * Label + control + help/error wrapper built on `Box`/`Text`.
 */
export const FieldWrapper = ({
  label,
  htmlFor,
  required,
  help,
  error,
  children,
}: FieldWrapperProps) => {
  return (
    <Box className="flex-col gap-1.5">
      <Text
        as="label"
        htmlFor={htmlFor}
        size="caption"
        className="font-medium text-gray-700"
      >
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </Text>
      {children}
      {error ? (
        <Text size="caption" className="text-red-600">
          {error}
        </Text>
      ) : help ? (
        <Text size="caption" className="text-gray-400">
          {help}
        </Text>
      ) : null}
    </Box>
  );
};

export { inputClass };

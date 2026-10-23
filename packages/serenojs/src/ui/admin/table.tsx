import type { ReactNode } from "react";

import { Box } from "../box.js";
import { Text } from "../text.js";
import { useI18n } from "./i18n.js";

export type Column<T> = {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: T) => ReactNode;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty?: string;
  loading?: boolean;
  caption?: string;
};

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

const cellAlign = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
} as const;

/**
 * Real semantic `<table>` rendered inside a horizontally scrollable wrapper so
 * it stays usable on small screens.
 */
export const DataTable = <T,>({
  columns,
  rows,
  rowKey,
  empty,
  loading = false,
  caption,
}: DataTableProps<T>) => {
  const { t } = useI18n();
  const columnCount = columns.length;

  return (
    <Box className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full min-w-full border-collapse">
        {caption ? (
          <caption className="px-4 py-2 text-left text-xs text-gray-400">
            {caption}
          </caption>
        ) : null}
        <thead className="bg-gray-50">
          <tr className="border-b border-gray-200">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={`max-w-[240px] whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
                  alignClass[column.align ?? "left"]
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columnCount} className="px-4 py-10 text-center">
                <Text size="caption" className="text-gray-400">
                  {t("table.loading")}
                </Text>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="px-4 py-10 text-center">
                <Text size="caption" className="text-gray-400">
                  {empty ?? t("table.empty")}
                </Text>
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`max-w-[240px] px-4 py-3 align-middle ${alignClass[column.align ?? "left"]}`}
                  >
                    <Box
                      className={`min-w-0 max-w-full overflow-hidden ${cellAlign[column.align ?? "left"]}`}
                    >
                      {column.render ? (
                        column.render(row)
                      ) : (
                        <Text
                          as="span"
                          size="caption"
                          className="block truncate text-gray-700"
                        >
                          {String(
                            (row as Record<string, unknown>)[column.key] ?? "",
                          )}
                        </Text>
                      )}
                    </Box>
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Box>
  );
};

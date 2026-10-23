import { Box } from "../box.js";
import { Button } from "../button.js";
import { Text } from "../text.js";
import { useI18n } from "./i18n.js";

export type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
};

/**
 * Simple previous/next pagination with a result summary.
 */
export const Pagination = ({
  page,
  totalPages,
  total,
  limit,
  onPage,
}: PaginationProps) => {
  const { t } = useI18n();
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <Box className="items-center justify-between gap-4 pt-4">
      <Text size="caption" className="text-gray-500">
        {t("pagination.range", { from, to, total })}
      </Text>
      <Box className="items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          {t("pagination.previous")}
        </Button>
        <Text size="caption" className="px-1 text-gray-600">
          {page} / {totalPages}
        </Text>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          {t("pagination.next")}
        </Button>
      </Box>
    </Box>
  );
};

import { ChevronLeftIcon, ChevronRightIcon, EllipsisIcon } from "lucide-react";
import { type ComponentProps, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, isWeb } from "@/utils";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type PageItem = number | "ellipsis-start" | "ellipsis-end";

function getPageItems(current: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-end", totalPages];
  }

  if (current >= totalPages - 3) {
    return [
      1,
      "ellipsis-start",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "ellipsis-start",
    current - 1,
    current,
    current + 1,
    "ellipsis-end",
    totalPages,
  ];
}

interface PaginationControlProps extends Omit<
  ComponentProps<"nav">,
  "onChange"
> {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showSizeChanger?: boolean;
}

function PaginationControl({
  className,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  showSizeChanger,
  ...props
}: PaginationControlProps) {
  const { t } = useTranslation();
  const hasItems = total > 0;
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safeCurrent = Math.min(Math.max(page, 1), totalPages);
  const pageItems = getPageItems(safeCurrent, totalPages);
  const sizeOptions = pageSizeOptions.includes(safePageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, safePageSize];
  const canChangePageSize =
    Boolean(onPageSizeChange) && (showSizeChanger ?? total > 50);

  useEffect(() => {
    if (page !== safeCurrent) onPageChange(safeCurrent);
  }, [onPageChange, page, safeCurrent]);

  const changePage = (nextPage: number) => {
    if (!hasItems) return;
    onPageChange(Math.min(Math.max(nextPage, 1), totalPages));
  };

  const changePageSize = (value: string) => {
    const nextPageSize = Number(value);
    const nextTotalPages = Math.max(1, Math.ceil(total / nextPageSize));
    onPageChange(Math.min(safeCurrent, nextTotalPages));
    onPageSizeChange?.(nextPageSize);
  };

  return (
    <nav
      aria-label={t("pagination")}
      className={cn("flex items-center gap-1", className)}
      {...props}
    >
      <Button
        type="button"
        variant="outline"
        className={cn(isWeb ? "size-8" : "size-6", "rounded-md p-0")}
        aria-label={t("previousPage")}
        disabled={!hasItems || safeCurrent === 1}
        onClick={() => changePage(safeCurrent - 1)}
      >
        <ChevronLeftIcon className="size-4" />
      </Button>

      {pageItems.map((item) => {
        if (typeof item !== "number") {
          const isBackward = item === "ellipsis-start";
          const label = t(
            isBackward ? "jumpBackwardPages" : "jumpForwardPages",
            { count: 5 },
          );
          return (
            <Button
              key={item}
              type="button"
              variant="ghost"
              className={cn(
                isWeb ? "size-8" : "size-6",
                "rounded-md p-0 text-muted-foreground",
              )}
              aria-label={label}
              title={label}
              onClick={() => changePage(safeCurrent + (isBackward ? -5 : 5))}
            >
              <EllipsisIcon className="size-4" />
            </Button>
          );
        }

        return (
          <Button
            key={item}
            type="button"
            variant={item === safeCurrent ? "default" : "ghost"}
            className={cn(isWeb ? "size-8" : "size-6", "rounded-md p-0")}
            aria-current={item === safeCurrent ? "page" : undefined}
            aria-label={t("pageNumber", { page: item })}
            disabled={!hasItems}
            onClick={() => changePage(item)}
          >
            {item}
          </Button>
        );
      })}

      <Button
        type="button"
        variant="outline"
        className={cn(isWeb ? "size-8" : "size-6", "rounded-md p-0")}
        aria-label={t("nextPage")}
        disabled={!hasItems || safeCurrent === totalPages}
        onClick={() => changePage(safeCurrent + 1)}
      >
        <ChevronRightIcon className="size-4" />
      </Button>

      {canChangePageSize ? (
        <Select value={String(safePageSize)} onValueChange={changePageSize}>
          <SelectTrigger
            size="sm"
            className={cn("ml-2 min-w-24", !isWeb && "h-6 min-w-20")}
            aria-label={t("itemsPerPage")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end" position="popper">
            {sizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {t("itemsPerPageCount", { count: size })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </nav>
  );
}

export { PaginationControl };
export type { PaginationControlProps };

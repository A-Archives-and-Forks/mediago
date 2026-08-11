import { useMemoizedFn } from "ahooks";
import { Container, Pencil, Search, Trash2 } from "lucide-react";
import { memo, useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appStoreSelector, useAppStore } from "@/store/app";
import {
  browserSourcesSelector,
  type SourceData,
  setBrowserSelector,
  useBrowserStore,
} from "@/store/browser";
import { usePlatform } from "@/hooks/use-platform";
import { createDownloadTasks } from "@/api/download-task";
import { DownloadTask } from "@mediago/shared-common";
import { filterSources } from "./source-filter";

interface SourceItemProps {
  item: SourceData;
  enableDocker: boolean;
  onDelete: (url: string) => void;
  onEdit: (items: SourceData[]) => void;
  onDownload: (item: SourceData) => void;
}

const SourceItem = memo(function SourceItem({
  item,
  enableDocker,
  onDelete,
  onEdit,
  onDownload,
}: SourceItemProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 border-b px-1 py-3 last:border-b-0">
      <span
        className="line-clamp-2 cursor-default break-words text-sm text-foreground"
        title={item.name}
      >
        {item.name}
      </span>
      <span
        className="line-clamp-2 cursor-default break-words text-xs text-muted-foreground"
        title={item.url}
      >
        {item.url}
      </span>
      <div className="flex flex-row items-center justify-between gap-3">
        <div className="flex flex-row items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-6 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(item.url)}
            title={t("delete")}
            aria-label={t("delete")}
          >
            <Trash2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-6 p-0"
            title={t("edit")}
            aria-label={t("edit")}
            onClick={() => onEdit([item])}
          >
            <Pencil className="size-4" />
          </Button>
          {enableDocker ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-6 p-0"
              title={t("edit")}
              aria-label={t("edit")}
              onClick={() => onEdit([item])}
            >
              <Container className="size-4" />
            </Button>
          ) : null}
        </div>
        <Button type="button" size="sm" onClick={() => onDownload(item)}>
          {t("downloadNow")}
        </Button>
      </div>
    </div>
  );
});

export function BrowserViewPanel() {
  const { sources } = useBrowserStore(useShallow(browserSourcesSelector));
  const { enableDocker } = useAppStore(useShallow(appStoreSelector));
  const { deleteSource, clearSources } = useBrowserStore(
    useShallow(setBrowserSelector),
  );
  const { t } = useTranslation();
  const { browser } = usePlatform();
  const [filterQuery, setFilterQuery] = useState("");
  const deferredFilterQuery = useDeferredValue(filterQuery);
  const filteredSources = useMemo(
    () => filterSources(sources, deferredFilterQuery),
    [deferredFilterQuery, sources],
  );

  const handleClear = useMemoizedFn(() => {
    clearSources();
  });

  const handleEdit = useMemoizedFn((items: SourceData[]) => {
    browser.showDownloadDialog(items);
  });

  const handleDownloadNow = useMemoizedFn(async (item: SourceData) => {
    try {
      const downloadTask: Omit<DownloadTask, "id"> = {
        url: item.url,
        name: item.name,
        headers: item.headers,
        type: item.type,
        folder: "",
      };
      await createDownloadTasks([downloadTask], true);
      // Badge increments via the "download-create" SSE event (see
      // apps/ui/src/api/events.ts), so no local increase() call needed.
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="mx-3 flex shrink-0 items-center gap-2 border-b py-3">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={filterQuery}
            className="pl-8"
            placeholder={t("filterSources")}
            aria-label={t("filterSources")}
            onChange={(event) => setFilterQuery(event.target.value)}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={handleClear}
        >
          {t("clear")}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
        {filteredSources.length > 0 ? (
          filteredSources.map((item) => (
            <SourceItem
              key={item.id}
              item={item}
              enableDocker={enableDocker}
              onDelete={deleteSource}
              onEdit={handleEdit}
              onDownload={handleDownloadNow}
            />
          ))
        ) : (
          <p
            className="flex min-h-24 items-center justify-center px-4 text-center text-sm text-muted-foreground"
            role="status"
          >
            {t("noMatchingSources")}
          </p>
        )}
      </div>
    </div>
  );
}

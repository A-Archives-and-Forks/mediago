import { useMemoizedFn } from "ahooks";
import { Container, Pencil, Trash2 } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col gap-2 rounded-lg bg-[#FAFCFF] p-2 dark:bg-[#27292F]">
      <span
        className="line-clamp-2 cursor-default break-words text-sm text-[#343434] dark:text-[#B4B4B4]"
        title={item.name}
      >
        {item.name}
      </span>
      <span
        className="line-clamp-2 cursor-default break-words text-xs dark:text-[#515257]"
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
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-white p-3 dark:bg-[#1F2024]">
      <div>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={handleClear}
        >
          {t("clear")}
        </Button>
      </div>
      {sources.map((item) => (
        <SourceItem
          key={item.id}
          item={item}
          enableDocker={enableDocker}
          onDelete={deleteSource}
          onEdit={handleEdit}
          onDownload={handleDownloadNow}
        />
      ))}
    </div>
  );
}

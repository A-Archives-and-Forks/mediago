import { DownloadFilter, type DownloadTask } from "@mediago/shared-common";
import { useMemoizedFn } from "ahooks";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  deleteDownloadTask,
  startDownload,
  stopDownload,
} from "@/api/download-task";
import emptyCompleted from "@/assets/images/empty-states/empty-completed.png";
import emptyDownloads from "@/assets/images/empty-states/empty-downloads.png";
import emptyError from "@/assets/images/empty-states/empty-error.png";
import { AppEmptyState } from "@/components/app-empty-state";
import Loading from "@/components/loading";
import { Button } from "@/components/ui/button";
import { EDIT_DOWNLOAD } from "@/const";
import { usePlatform } from "@/hooks/use-platform";
import type { DownloadTaskDetails } from "@/hooks/use-tasks";
import { useDownloadDialogStore } from "@/store/download-dialog";
import { cn, tdApp } from "@/utils";
import { DownloadTaskItem } from "./download-item";
import { ListHeader } from "./list-header";

interface Props {
  filter: DownloadFilter;
  data: DownloadTaskDetails[];
  isLoading: boolean;
  error?: unknown;
  mutate: () => Promise<unknown>;
}

export function DownloadTaskList({
  filter,
  data,
  isLoading,
  error,
  mutate,
}: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const { contextMenu } = usePlatform();
  const { t } = useTranslation();
  const openNew = useDownloadDialogStore((state) => state.openNew);
  const openEdit = useDownloadDialogStore((state) => state.openEdit);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    },
    [],
  );

  const handleItemSelectChange = useMemoizedFn((id: number) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  });

  const selectItem = useMemoizedFn((id: number) => {
    setSelected((current) =>
      current.includes(id) ? current : [...current, id],
    );
  });

  const handleSelectAll = useMemoizedFn(() => {
    setSelected((current) =>
      current.length > 0 ? [] : data.map((task) => task.id),
    );
  });

  const listChecked = useMemo(() => {
    if (selected.length === 0) return false;
    return selected.length === data.length ? true : "indeterminate";
  }, [selected.length, data.length]);

  const onStartDownload = useMemoizedFn(async (id: number) => {
    await startDownload(id);
    toast.success(t("downloadStarted"));
    await mutate();
  });

  const onStopDownload = useMemoizedFn(async (id: number) => {
    await stopDownload(id);
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      void mutate();
      refreshTimeoutRef.current = null;
    }, 500);
  });

  const onDelete = useMemoizedFn(async (id: number) => {
    await deleteDownloadTask(id);
    setSelected((current) => current.filter((selectedId) => selectedId !== id));
    await mutate();
  });

  const handleContext = useMemoizedFn(async (id: number) => {
    const action = await contextMenu.show([
      { key: "select", label: t("select") },
      { key: "download", label: t("download") },
      { key: "refresh", label: t("refresh") },
      { key: "separator", label: "", type: "separator" },
      { key: "delete", label: t("delete") },
    ]);
    if (action === "select") selectItem(id);
    else if (action === "download") await onStartDownload(id);
    else if (action === "refresh") await mutate();
    else if (action === "delete") await onDelete(id);
  });

  const onDeleteItems = useMemoizedFn(async (ids: number[]) => {
    await Promise.allSettled(ids.map((id) => deleteDownloadTask(id)));
    setSelected([]);
    await mutate();
  });

  const onDownloadItems = useMemoizedFn(async (ids: number[]) => {
    await Promise.allSettled(ids.map((id) => startDownload(id)));
    toast.success(t("downloadStarted"));
    setSelected([]);
    await mutate();
  });

  const handleShowDownloadForm = useMemoizedFn((task: DownloadTask) => {
    tdApp.onEvent(EDIT_DOWNLOAD);
    openEdit(task);
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ListHeader
        selected={selected}
        checked={listChecked}
        onSelectAll={handleSelectAll}
        onDeleteItems={onDeleteItems}
        onDownloadItems={onDownloadItems}
        onCancelItems={() => setSelected([])}
        filter={filter}
      />
      <div className={cn("flex w-full flex-1 shrink-0 flex-col overflow-auto")}>
        {isLoading ? <Loading /> : null}
        {!isLoading && error && data.length === 0 ? (
          <AppEmptyState
            className="h-full"
            illustration={emptyError}
            title={t("loadFailed")}
            description={t("loadFailedDescription")}
            actions={
              <Button type="button" onClick={() => void mutate()}>
                {t("refresh")}
              </Button>
            }
          />
        ) : null}
        {!isLoading && !error && data.length === 0 ? (
          <AppEmptyState
            className="h-full"
            illustration={
              filter === DownloadFilter.list ? emptyDownloads : emptyCompleted
            }
            title={
              filter === DownloadFilter.list
                ? t("emptyDownloadsTitle")
                : t("emptyCompletedTitle")
            }
            description={
              filter === DownloadFilter.list
                ? t("emptyDownloadsDescription")
                : t("emptyCompletedDescription")
            }
            actions={
              filter === DownloadFilter.list ? (
                <Button type="button" onClick={() => openNew()}>
                  <Plus />
                  {t("newDownload")}
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link to="/">{t("downloadList")}</Link>
                </Button>
              )
            }
          />
        ) : null}
        {data.map((task) => (
          <DownloadTaskItem
            key={task.id}
            task={task}
            selected={selected.includes(task.id)}
            onSelectChange={handleItemSelectChange}
            onSelect={selectItem}
            onStartDownload={onStartDownload}
            onStopDownload={onStopDownload}
            onContextMenu={handleContext}
            onDelete={onDelete}
            onRefresh={mutate}
            onShowEditForm={handleShowDownloadForm}
          />
        ))}
      </div>
    </div>
  );
}

export const DownloadList = DownloadTaskList;

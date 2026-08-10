import type { DownloadFilter, DownloadTask } from "@mediago/shared-common";
import { useMemoizedFn } from "ahooks";
import { produce } from "immer";
import { InboxIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import DownloadForm, { type DownloadFormRef } from "@/components/download-form";
import Loading from "@/components/loading";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { EDIT_DOWNLOAD } from "@/const";
import { usePlatform } from "@/hooks/use-platform";
import {
  startDownload,
  stopDownload,
  deleteDownloadTask,
} from "@/api/download-task";
import type { DownloadTaskDetails } from "@/hooks/use-tasks";
import { cn, tdApp } from "@/utils";
import { DownloadTaskItem } from "./download-item";
import { ListHeader } from "./list-header";

interface Props {
  filter: DownloadFilter;
  data: DownloadTaskDetails[];
  isLoading: boolean;
  mutate: () => Promise<unknown>;
}

export function DownloadTaskList({ filter, data, isLoading, mutate }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const { contextMenu } = usePlatform();
  const { t } = useTranslation();
  const editFormRef = useRef<DownloadFormRef>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadListId = useId();
  useEffect(() => {
    return () => {
      // Clean up any pending refresh timers
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, []);

  const handleItemSelectChange = useMemoizedFn((id: number) => {
    setSelected(
      produce((draft) => {
        const index = draft.indexOf(id);
        if (index !== -1) {
          draft.splice(index, 1);
        } else {
          draft.push(id);
        }
      }),
    );
  });

  const handleSelectAll = useMemoizedFn(() => {
    setSelected(
      produce((draft) => {
        if (draft.length) {
          draft.splice(0, draft.length);
        } else {
          draft.push(...data.map((task) => task.id));
        }
      }),
    );
  });

  const listChecked = useMemo(() => {
    if (selected.length === 0) {
      return false;
    }
    if (selected.length === data.length) {
      return true;
    }
    return "indeterminate";
  }, [selected, data.length]);

  const onStartDownload = useMemoizedFn(async (id: number) => {
    await startDownload(id);

    toast.success(t("addTaskSuccess"));
    mutate();
  });

  const onStopDownload = useMemoizedFn(async (id: number) => {
    await stopDownload(id);

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      mutate();
      refreshTimeoutRef.current = null;
    }, 500);
  });

  const handleFormConfirm = useMemoizedFn(async () => {
    mutate();
  });

  const handleContext = useMemoizedFn(async (id: number) => {
    const action = await contextMenu.show([
      { key: "select", label: t("select") },
      { key: "download", label: t("download") },
      { key: "refresh", label: t("refresh") },
      { key: "separator", label: "", type: "separator" },
      { key: "delete", label: t("delete") },
    ]);
    if (action === "select") {
      setSelected((keys) => [...keys, id]);
    } else if (action === "download") {
      onStartDownload(id);
    } else if (action === "refresh") {
      mutate();
    } else if (action === "delete") {
      await deleteDownloadTask(id);
      mutate();
    }
  });

  const onDeleteItems = useMemoizedFn(async (ids: number[]) => {
    await Promise.allSettled(ids.map((id) => deleteDownloadTask(Number(id))));
    setSelected([]);
    mutate();
  });

  const onDownloadItems = useMemoizedFn(async (ids: number[]) => {
    await Promise.allSettled(ids.map((id) => startDownload(Number(id))));

    toast.success(t("addTaskSuccess"));
    mutate();
    setSelected([]);
  });

  const onCancelItems = useMemoizedFn(async () => {
    setSelected([]);
  });

  const handleShowDownloadForm = useMemoizedFn((task: DownloadTask) => {
    tdApp.onEvent(EDIT_DOWNLOAD);
    const { id, name, url, headers, type, folder } = task;
    const values = {
      batch: false,
      id,
      name,
      url,
      headers,
      type,
      folder,
    };
    editFormRef.current?.openModal(values);
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ListHeader
        selected={selected}
        checked={listChecked}
        onSelectAll={handleSelectAll}
        onDeleteItems={onDeleteItems}
        onDownloadItems={onDownloadItems}
        onCancelItems={onCancelItems}
        filter={filter}
      />
      <div className={cn("flex w-full flex-1 shrink-0 flex-col overflow-auto")}>
        {isLoading && <Loading />}
        {data.length === 0 && !isLoading && (
          <div className="flex h-full flex-1 flex-row items-center justify-center">
            <Empty>
              <EmptyMedia variant="icon">
                <InboxIcon />
              </EmptyMedia>
              <EmptyDescription>{t("noData")}</EmptyDescription>
            </Empty>
          </div>
        )}
        {data.length > 0 &&
          data.map((task) => {
            return (
              <DownloadTaskItem
                key={task.id}
                task={task}
                selected={selected.includes(task.id)}
                onSelectChange={handleItemSelectChange}
                onStartDownload={onStartDownload}
                onStopDownload={onStopDownload}
                onContextMenu={handleContext}
                onShowEditForm={handleShowDownloadForm}
              />
            );
          })}
      </div>
      <DownloadForm
        id={downloadListId}
        ref={editFormRef}
        isEdit
        onConfirm={handleFormConfirm}
      />
    </div>
  );
}

// Legacy export for backward compatibility
export const DownloadList = DownloadTaskList;

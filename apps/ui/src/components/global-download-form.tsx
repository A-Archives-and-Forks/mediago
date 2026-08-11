import { useEffect, useRef } from "react";
import { useSWRConfig } from "swr";
import { useConfigStore } from "@/store/config";
import { useDownloadDialogStore } from "@/store/download-dialog";
import DownloadForm, { type DownloadFormRef } from "./download-form";

export function GlobalDownloadForm() {
  const formRef = useRef<DownloadFormRef>(null);
  const { mutate } = useSWRConfig();
  const mode = useDownloadDialogStore((state) => state.mode);
  const open = useDownloadDialogStore((state) => state.open);
  const requestId = useDownloadDialogStore((state) => state.requestId);
  const values = useDownloadDialogStore((state) => state.values);
  const close = useDownloadDialogStore((state) => state.close);

  useEffect(() => {
    if (!open) return;
    const { lastIsBatch, lastDownloadTypes } = useConfigStore.getState();
    formRef.current?.openModal(
      mode === "new"
        ? {
            batch: lastIsBatch,
            type: lastDownloadTypes,
            ...values,
          }
        : values,
    );
  }, [mode, open, requestId, values]);

  const refreshTasks = () =>
    mutate(
      (key) =>
        typeof key === "object" &&
        key !== null &&
        "key" in key &&
        key.key === "api/tasks",
    );

  return (
    <DownloadForm
      id="global-download-form"
      ref={formRef}
      isEdit={mode === "edit"}
      onConfirm={refreshTasks}
      onFormVisibleChange={(visible) => {
        if (!visible) close();
      }}
    />
  );
}

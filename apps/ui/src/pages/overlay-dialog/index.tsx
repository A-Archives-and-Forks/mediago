import {
  type DownloadTask,
  DownloadType,
  IpcEvent,
} from "@mediago/shared-common";
import { useEffect, useId, useRef } from "react";
import DownloadForm, { type DownloadFormRef } from "@/components/download-form";
import { usePlatform } from "@/hooks/use-platform";

import "./index.css";

const downloadTypes = new Set<unknown>(Object.values(DownloadType));

function isOverlayDownloadTask(
  value: unknown,
): value is Omit<DownloadTask, "id"> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const task = value as Record<string, unknown>;
  return (
    downloadTypes.has(task.type) &&
    typeof task.name === "string" &&
    typeof task.url === "string" &&
    (task.headers === undefined || typeof task.headers === "string")
  );
}

export default function OverlayDialog() {
  const { on, off, browser } = usePlatform();
  const downloadForm = useRef<DownloadFormRef>(null);
  const dialogId = useId();

  useEffect(() => {
    const onShowOverlayDialog = (...args: unknown[]) => {
      const data = args[1];
      if (!Array.isArray(data) || !isOverlayDownloadTask(data[0])) {
        return;
      }
      const item = data[0];
      downloadForm.current?.openModal({
        batch: false,
        type: item.type,
        url: item.url,
        name: item.name,
        headers: item.headers,
      });
    };

    on(IpcEvent.browser.showOverlayDialog, onShowOverlayDialog);

    return () => {
      off(IpcEvent.browser.showOverlayDialog, onShowOverlayDialog);
    };
  }, [on, off]);

  const handleFormVisibleChange = (visible: boolean) => {
    if (!visible) {
      browser.dismissOverlayDialog();
    }
  };

  return (
    <DownloadForm
      id={dialogId}
      isEdit
      ref={downloadForm}
      onFormVisibleChange={handleFormVisibleChange}
    />
  );
}

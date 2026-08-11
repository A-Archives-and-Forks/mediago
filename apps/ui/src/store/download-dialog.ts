import { DownloadType, type DownloadTask } from "@mediago/shared-common";
import { create } from "zustand";

export interface DownloadFormItem {
  batch?: boolean;
  batchList?: string;
  name?: string;
  type?: DownloadType;
  headers?: string;
  url?: string;
  id?: number;
  folder?: string;
}

type DownloadDialogMode = "new" | "edit";

interface DownloadDialogState {
  mode: DownloadDialogMode;
  open: boolean;
  requestId: number;
  values: DownloadFormItem;
  openNew: (values?: DownloadFormItem) => void;
  openEdit: (task: DownloadTask) => void;
  close: () => void;
}

export const useDownloadDialogStore = create<DownloadDialogState>((set) => ({
  mode: "new",
  open: false,
  requestId: 0,
  values: {},
  openNew: (values = {}) =>
    set((state) => ({
      mode: "new",
      open: true,
      requestId: state.requestId + 1,
      values,
    })),
  openEdit: (task) =>
    set((state) => ({
      mode: "edit",
      open: true,
      requestId: state.requestId + 1,
      values: {
        batch: false,
        id: task.id,
        name: task.name,
        url: task.url,
        headers: task.headers,
        type: task.type,
        folder: task.folder,
      },
    })),
  close: () => set({ open: false }),
}));

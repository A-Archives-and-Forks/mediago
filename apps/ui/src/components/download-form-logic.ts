import { DownloadType, type DownloadTask } from "@mediago/shared-common";

export const DOWNLOAD_URL_RE = /^(?:(?:file|https?):\/\/.+|magnet:\?.+)/i;

export interface BatchDownloadRow {
  folder: string;
  line: number;
  name: string;
  url: string;
  valid: boolean;
}

export function parseBatchDownloadRows(text: string): BatchDownloadRow[] {
  return text
    .split(/\r?\n/)
    .map((value, index) => ({ value: value.trim(), line: index + 1 }))
    .filter(({ value }) => value.length > 0)
    .map(({ line, value }) => {
      const parts = value.split(/\s+/);
      const [url = "", name = "", folder = ""] = parts;
      return {
        folder,
        line,
        name,
        url,
        valid: parts.length <= 3 && DOWNLOAD_URL_RE.test(url),
      };
    });
}

export function buildBatchDownloadTasks(
  rows: BatchDownloadRow[],
  type: DownloadType,
  headers?: string,
): Omit<DownloadTask, "id">[] {
  return rows.map(({ folder, name, url }) => ({
    url,
    name: name || "",
    headers: headers || undefined,
    type,
    folder: folder || undefined,
  }));
}

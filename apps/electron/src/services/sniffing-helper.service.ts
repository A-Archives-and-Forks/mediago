import EventEmitter from "node:events";
import { provide } from "@inversifyjs/binding-decorators";
import {
  DownloadType,
  type HLSMediaInfo,
  matchPageUrl,
  matchRequestUrl,
} from "@mediago/shared-common";
import { type OnSendHeadersListenerDetails, session } from "electron";
import { inject, injectable } from "inversify";
import {
  formatHeaders,
  PERSIST_WEBVIEW,
  PRIVACY_WEBVIEW,
  urlCache,
} from "../utils";
import ElectronLogger from "../vendor/ElectronLogger";
import {
  formattedHeadersToArray,
  inspectionToMediaInfo,
} from "../utils/source-inspection";
import { DownloaderServer } from "./downloader.server";

export interface SourceParams {
  url: string;
  documentURL: string;
  name: string;
  type: DownloadType;
  headers?: string;
  mediaInfo?: HLSMediaInfo;
}

interface PageInfo {
  title: string;
  url: string;
}

@injectable()
@provide()
export class SniffingHelper extends EventEmitter {
  private pageInfo: PageInfo = { title: "", url: "" };
  private readonly prepareDelay = 1000;
  private readonly inspectDelay = 150;
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private inspectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly pageHeaders = new Map<DownloadType, string>();
  private readonly pendingInspections = new Map<
    string,
    { id: string; item: SourceParams }
  >();
  private inspectSequence = 0;
  private navigationGeneration = 0;

  constructor(
    @inject(ElectronLogger)
    private readonly logger: ElectronLogger,
    @inject(DownloaderServer)
    private readonly downloaderServer: DownloaderServer,
  ) {
    super();
  }

  pluginReady() {
    // empty
  }

  getPageHeaders(type: DownloadType): string | undefined {
    return this.pageHeaders.get(type);
  }

  update(pageInfo: PageInfo) {
    const pageChanged = pageInfo.url !== this.pageInfo.url;
    this.pageInfo = pageInfo;
    // Cancel pending check from previous page
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }
    if (pageChanged) {
      this.navigationGeneration += 1;
      this.pendingInspections.clear();
      if (this.inspectTimer) {
        clearTimeout(this.inspectTimer);
        this.inspectTimer = null;
      }
      // Reset dedup cache when navigating to a new page.
      urlCache.clear();
    }
  }

  checkPageInfo() {
    // Cancel any pending check
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
    }

    // Capture current page info to avoid race conditions
    const pageInfo = { ...this.pageInfo };

    this.checkTimer = setTimeout(() => {
      this.checkTimer = null;
      const filter = matchPageUrl(pageInfo.url);
      if (filter) {
        this.send({
          url: pageInfo.url,
          documentURL: pageInfo.url,
          name: pageInfo.title,
          type: filter.type,
          headers: this.pageHeaders.get(filter.type),
        });
      }
    }, this.prepareDelay);
  }

  start(privacy: boolean = false) {
    this.pageHeaders.clear();
    const partition = privacy ? PRIVACY_WEBVIEW : PERSIST_WEBVIEW;
    const viewSession = session.fromPartition(partition);
    viewSession.webRequest.onSendHeaders(this.onSendHeaders);
  }

  send = (item: SourceParams) => {
    const urlCacheKey = `${item.url}_${item.name}`;
    const cacheUrl = urlCache.get(urlCacheKey);
    if (cacheUrl) {
      return;
    }

    urlCache.set(urlCacheKey, true);

    if (item.type !== DownloadType.m3u8) {
      this.emitSource(item);
      return;
    }

    const id = `hls-${Date.now()}-${++this.inspectSequence}`;
    this.emitSource({
      ...item,
      mediaInfo: {
        status: "inspecting",
        playlistType: "unknown",
        variants: [],
      },
    });
    this.pendingInspections.set(item.url, { id, item });
    if (!this.inspectTimer) {
      this.inspectTimer = setTimeout(() => {
        this.inspectTimer = null;
        void this.flushInspections();
      }, this.inspectDelay);
    }
  };

  private emitSource(item: SourceParams): void {
    this.logger.info(`[SniffingHelper] send: ${item.url}`);
    this.emit("source", item);
  }

  private async flushInspections(): Promise<void> {
    const pending = [...this.pendingInspections.values()];
    this.pendingInspections.clear();
    if (pending.length === 0) return;

    const generation = this.navigationGeneration;
    try {
      const client = this.downloaderServer.getClient();
      const inputs = pending.map(({ id, item }) => ({
        id,
        url: item.url,
        headers: formattedHeadersToArray(item.headers),
      }));
      const requests = [];
      for (let index = 0; index < inputs.length; index += 20) {
        requests.push(
          client.inspectSources({ sources: inputs.slice(index, index + 20) }),
        );
      }
      const responses = await Promise.all(requests);
      const inspections = new Map(
        responses.flatMap((response) =>
          response.data.sources.map(
            (inspection) => [inspection.id, inspection] as const,
          ),
        ),
      );
      if (generation !== this.navigationGeneration) return;
      for (const { id, item } of pending) {
        this.emitSource({
          ...item,
          mediaInfo: inspectionToMediaInfo(inspections.get(id)),
        });
      }
    } catch (error) {
      this.logger.warn("Failed to inspect sniffed HLS sources", error);
      if (generation !== this.navigationGeneration) return;
      for (const { item } of pending) {
        this.emitSource({ ...item, mediaInfo: inspectionToMediaInfo() });
      }
    }
  }

  private onSendHeaders = (details: OnSendHeadersListenerDetails): void => {
    const { url, requestHeaders } = details;
    const { title, url: documentURL } = this.pageInfo;
    const headers = formatHeaders(requestHeaders);

    const cookieBackedType = getCookieBackedType(url);
    if (cookieBackedType && hasHeader(requestHeaders, "cookie")) {
      this.pageHeaders.set(cookieBackedType, headers);
    }

    const filter = matchRequestUrl(url);
    if (filter) {
      this.send({
        url,
        documentURL,
        name: title,
        type: filter.type,
        headers,
      });
    }
  };
}

export function hasHeader(
  headers: Record<string, string>,
  name: string,
): boolean {
  return Object.keys(headers).some(
    (headerName) => headerName.toLowerCase() === name.toLowerCase(),
  );
}

export function getCookieBackedType(url: string): DownloadType | undefined {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname === "bilibili.com" || hostname.endsWith(".bilibili.com")) {
      return DownloadType.bilibili;
    }
  } catch {
    // Ignore malformed request URLs.
  }
  return undefined;
}

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  DownloadType,
  type HLSMediaInfo,
  mergeSniffedSource,
} from "@mediago/shared-common";
import { subscribeWithSelector } from "zustand/middleware";

export enum PageMode {
  Default = "default",
  Browser = "browser",
}

export enum BrowserStatus {
  Default = "default",
  Loaded = "loaded",
  Loading = "loading",
  Failed = "failed",
}

export interface SourceData {
  id: number;
  url: string;
  documentURL: string;
  name: string;
  type: DownloadType;
  headers?: string;
  mediaInfo?: HLSMediaInfo;
}

const initialState: BrowserStore = {
  mode: PageMode.Default,
  url: "",
  title: "",
  status: BrowserStatus.Default,
  errMsg: "",
  errCode: 0,
  sources: [],
  sourcePanelCollapsed: false,
};

type Actions = {
  setBrowserStore: (values: Partial<BrowserStore>) => void;
  startNavigation: (url: string) => void;
  addSource: (source: SourceData) => void;
  deleteSource: (url: string) => void;
  setSources: (sources: SourceData[]) => void;
  clearSources: () => void;
};

export const useBrowserStore = create<BrowserStore & Actions>()(
  immer(
    subscribeWithSelector((set) => ({
      ...initialState,
      setBrowserStore: (values) =>
        set((state) => {
          Object.keys(values).forEach((key) => {
            if (values[key] != null) {
              state[key] = values[key] as never;
            }
          });
        }),
      startNavigation: (url) =>
        set((state) => {
          state.url = url;
          state.mode = PageMode.Browser;
          state.status = BrowserStatus.Loading;
          state.sources = [];
          state.errMsg = "";
          state.errCode = 0;
        }),
      addSource: (source) =>
        set((state) => {
          const existing = state.sources.find(
            (item: SourceData) => item.url === source.url,
          );
          let nextId = 1;
          for (const item of state.sources) {
            nextId = Math.max(nextId, item.id + 1);
          }
          const normalized = {
            ...source,
            id: existing?.id ?? nextId,
          };
          state.sources = mergeSniffedSource(
            state.sources as SourceData[],
            normalized,
          );
        }),
      deleteSource: (url) =>
        set((state) => {
          state.sources = state.sources.filter(
            (item: SourceData) => item.url !== url,
          );
        }),
      setSources: (sources) =>
        set((state) => {
          state.sources = sources;
        }),
      clearSources: () =>
        set((state) => {
          state.sources = [];
        }),
    })),
  ),
);

/** Full selector — use only when all fields are needed */
export const browserStoreSelector = (state: BrowserStore & Actions) => {
  return {
    mode: state.mode,
    url: state.url,
    title: state.title,
    status: state.status,
    errMsg: state.errMsg,
    errCode: state.errCode,
    sources: state.sources,
  };
};

/** Navigation-only selector — url/title/status/mode (no sources) */
export const browserNavSelector = (state: BrowserStore & Actions) => ({
  url: state.url,
  title: state.title,
  status: state.status,
  mode: state.mode,
});

/** Sources-only selector */
export const browserSourcesSelector = (state: BrowserStore & Actions) => ({
  sources: state.sources,
});

/** Source-panel summary — avoids subscribing layout controls to source details. */
export const browserSourcePanelSelector = (state: BrowserStore & Actions) => ({
  hasSources: state.sources.length > 0,
  sourceCount: state.sources.length,
  sourcePanelCollapsed: state.sourcePanelCollapsed,
});

/** Error-only selector */
export const browserErrorSelector = (state: BrowserStore & Actions) => ({
  status: state.status,
  errMsg: state.errMsg,
  errCode: state.errCode,
});

export const setBrowserSelector = (state: BrowserStore & Actions) => {
  return {
    setBrowserStore: state.setBrowserStore,
    startNavigation: state.startNavigation,
    addSource: state.addSource,
    deleteSource: state.deleteSource,
    setSources: state.setSources,
    clearSources: state.clearSources,
  };
};

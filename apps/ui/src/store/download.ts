import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";
import { normalizeDownloadPercent } from "./download-progress";

// Allow Immer to work with Map in state
enableMapSet();

interface DownloadEvent {
  percent: string;
  speed: string;
  id: number;
}

interface DownloadStore {
  count: number;
  events: DownloadEvent[];
  eventsMap: Map<string, DownloadEvent>;
}

const initialState: DownloadStore = {
  count: 0,
  events: [],
  eventsMap: new Map(),
};

type Actions = {
  clearCount: () => void;
  increase: () => void;
  setEvents: (events: DownloadEvent[]) => void;
};

export const useDownloadStore = create<DownloadStore & Actions>()(
  immer((set) => ({
    ...initialState,
    clearCount: () =>
      set((state) => {
        state.count = 0;
      }),
    increase: () =>
      set((state) => {
        state.count += 1;
      }),
    setEvents: (events: DownloadEvent[]) =>
      set((state) => {
        const normalized = events.map((item) => {
          const prevPercent = normalizeDownloadPercent(
            state.eventsMap.get(String(item.id))?.percent,
          );
          const currentPercent = normalizeDownloadPercent(item.percent);
          const percent = Math.min(
            100,
            Math.max(currentPercent ?? 0, prevPercent ?? 0, 0),
          );

          return {
            ...item,
            percent: percent.toString(),
          };
        });

        state.events = normalized;
        state.eventsMap = new Map(
          normalized.map((item) => [String(item.id), item]),
        );
      }),
  })),
);

export const downloadStoreSelector = (state: DownloadStore & Actions) => {
  return {
    count: state.count,
    clearCount: state.clearCount,
    increase: state.increase,
    events: state.events,
    eventsMap: state.eventsMap,
    setEvents: state.setEvents,
  };
};

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist } from "zustand/middleware";
import i18n from "../i18n";
import { migrateAppStore } from "./app-store-migration";
import { resolveAppLanguage } from "../utils";
import { AppLanguage, type AppStore, AppTheme } from "@mediago/shared-common";

const initialState: AppStore = {
  local: "",
  promptTone: true,
  proxy: "",
  useProxy: false,
  deleteSegments: true,
  openInNewWindow: false,
  theme: AppTheme.System,
  useExtension: false,
  isMobile: false,
  maxRunner: 2,
  language: AppLanguage.System,
  showTerminal: false,
  privacy: false,
  machineId: "",
  downloadProxySwitch: false,
  autoUpgrade: true,
  audioMuted: true,
  enableMobilePlayer: false,
  blockAds: true,
  allowBeta: false,
  enableDocker: false,
  dockerUrl: "",
  closeMainWindow: false,
  apiKey: "",
  enableMcp: false,
  mcpToken: "",
};

type Actions = {
  setAppStore: (values: Partial<AppStore>) => void;
};

export const useAppStore = create<AppStore & Actions>()(
  immer(
    persist(
      (set, get) => ({
        ...initialState,
        setAppStore: (values) => {
          const current = get();
          const changedEntries = Object.entries(values).filter(
            ([key, value]) => !Object.is(current[key as keyof AppStore], value),
          );
          if (changedEntries.length === 0) return;

          const language = changedEntries.find(
            ([key]) => key === "language",
          )?.[1] as AppLanguage | undefined;
          if (language !== undefined) {
            void i18n.changeLanguage(resolveAppLanguage(language));
          }

          set((state) => {
            changedEntries.forEach(([key, value]) => {
              (state as Record<string, unknown>)[key] = value;
            });
          });
        },
      }),
      {
        name: "appstore-storage",
        version: 1,
        migrate: migrateAppStore,
      },
    ),
  ),
);

export const appStoreSelector = (state: AppStore & Actions) => {
  const { setAppStore: _setAppStore, ...appStore } = state;
  return appStore;
};

export const setAppStoreSelector = (state: AppStore & Actions) => {
  return { setAppStore: state.setAppStore };
};

import { type FC, lazy, Suspense, useEffect, useRef, useState } from "react";
import { Route, Routes } from "react-router-dom";
import "dayjs/locale/zh-cn";
import "dayjs/locale/it";
import { useMemoizedFn } from "ahooks";
import { AppBootScreen } from "./components/app-boot-screen";
import Loading from "./components/loading";
import { Toaster } from "./components/ui/sonner";
import { PAGE_LOAD } from "./const";
import { useAppStore } from "./store/app";
import { PageMode, useBrowserStore } from "./store/browser";
import { useSessionStore } from "./store/session";
import { isWeb, tdApp } from "./utils";
import { usePlatform } from "./hooks/use-platform";
import { setupHttp } from "./utils/http";
import { getConfig } from "./api/config";
import { initGoEvents, onConfigChanged } from "./api/events";
import { settingConfigWriter } from "./services/setting-config-writer";
import {
  type ConfigChange,
  mergeDeferredConfigChanges,
} from "./services/config-change-order";
import { DownloadFilter, type AppStore } from "@mediago/shared-common";
import { AuthGuard } from "./hooks/use-auth";
import { resolveAppTheme } from "./utils/app-theme";

const AppLayout = lazy(() => import("./layout/app-layout"));
const HomePage = lazy(() => import("./pages/home-page"));
const SourceExtract = lazy(() => import("./pages/source-extract"));
const loadSettingPage = () => import("./pages/setting-page");
const SettingPage = lazy(loadSettingPage);
const ConverterPage = lazy(() => import("./pages/converter-page"));
const SigninPage = lazy(() => import("./pages/signin-page"));
const OverlayDialog = lazy(() => import("./pages/overlay-dialog"));

function isAppStoreKey(key: string): key is keyof AppStore {
  return key !== "setAppStore" && key in useAppStore.getState();
}

function canLoadProtectedConfig() {
  return !isWeb || useAppStore.getState().apiKey.length > 0;
}

let adapterCoreUrl = "";
let adapterInitialization: Promise<AppStore | null> | null = null;

function initializeAdapter(): Promise<AppStore | null> {
  if (adapterInitialization) return adapterInitialization;

  const initialization = (async () => {
    try {
      let coreUrl = adapterCoreUrl;

      if (!coreUrl && isWeb) {
        coreUrl = import.meta.env.DEV
          ? "http://127.0.0.1:9900"
          : window.location.origin;
      } else if (!coreUrl) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ipcResult: any = await window.electron?.app?.getEnvPath();
        const envPath =
          ipcResult && "code" in ipcResult && ipcResult.code === 0
            ? ipcResult.data
            : ipcResult;
        if (envPath && "coreUrl" in envPath && envPath.coreUrl) {
          coreUrl = envPath.coreUrl;
        }
      }

      if (!coreUrl) return null;

      if (!adapterCoreUrl) {
        adapterCoreUrl = coreUrl;
        setupHttp(coreUrl);
        initGoEvents(coreUrl);
      }

      // The sign-in page still needs the Core base URL for /api/auth/status,
      // but /api/config is protected in web mode. Wait until sign-in stores
      // an API key before loading the protected application configuration.
      if (!canLoadProtectedConfig()) return null;

      try {
        return await getConfig({ timeoutMs: 5000 });
      } catch {
        // Go Core may not be fully ready yet.
        return null;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Go adapter init failed:", error);
      return null;
    }
  })();

  adapterInitialization = initialization;
  void initialization.finally(() => {
    if (adapterInitialization === initialization) {
      adapterInitialization = null;
    }
  });

  return initialization;
}

const App: FC = () => {
  const { on, off } = usePlatform();
  const setUpdateAvailable = useSessionStore(
    (state) => state.setUpdateAvailable,
  );
  const setUploadChecking = useSessionStore((state) => state.setUploadChecking);
  const setAppStore = useAppStore((state) => state.setAppStore);
  const apiKey = useAppStore((state) => state.apiKey);
  const appTheme = useAppStore((state) => state.theme);
  const setBrowserStore = useBrowserStore((state) => state.setBrowserStore);
  const theme = useSessionStore((state) => state.theme);
  const setTheme = useSessionStore((state) => state.setTheme);
  const [adapterReady, setAdapterReady] = useState(false);
  const initialConfigReady = useRef(false);
  const bufferedConfigChanges = useRef<ConfigChange[]>([]);
  const configChangesToReconcile = useRef<ConfigChange[]>([]);
  const configReconcileNeeded = useRef(false);
  const configReconcilePromise = useRef<Promise<void> | null>(null);
  const configReconcileRetry = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const applyConfigChange = useMemoizedFn((data: ConfigChange) => {
    if (!isAppStoreKey(data.key)) return true;
    const key = data.key;
    const value = data.value as AppStore[typeof key];
    const pending = settingConfigWriter.getPending(key);
    if (pending.pending) {
      settingConfigWriter.acknowledgeInFlightValue(key, value);
      if (settingConfigWriter.matchesPendingValue(key, value)) return true;
      configReconcileNeeded.current = true;
      return false;
    }

    setAppStore({ [key]: value } as Partial<AppStore>);
    return true;
  });

  const scheduleConfigReconcile = useMemoizedFn(() => {
    if (!canLoadProtectedConfig()) return;
    if (configReconcilePromise.current) return;
    if (configReconcileRetry.current) {
      clearTimeout(configReconcileRetry.current);
      configReconcileRetry.current = null;
    }

    const applyReconcileChanges = (changes: ConfigChange[]) => {
      const deferred: ConfigChange[] = [];
      changes.forEach((change) => {
        if (!applyConfigChange(change)) {
          deferred.push(change);
        }
      });
      return deferred;
    };

    const reconcile = async () => {
      if (
        !configReconcileNeeded.current &&
        configChangesToReconcile.current.length === 0
      ) {
        return;
      }

      configReconcileNeeded.current = false;
      await settingConfigWriter.flush();
      if (!canLoadProtectedConfig()) {
        configReconcileNeeded.current = true;
        return;
      }

      const changesBeforeGet = configChangesToReconcile.current.splice(0);
      configChangesToReconcile.current.push(
        ...applyReconcileChanges(changesBeforeGet),
      );
      if (configChangesToReconcile.current.length > 0) {
        await reconcile();
        return;
      }

      const config = await getConfig({
        suppressAuthRedirect: true,
        timeoutMs: 5000,
      });
      // Events buffered while GET was in flight happened after its snapshot.
      // Keep them separate so a later local echo can supersede an older
      // deferred snapshot value for the same key.
      const eventsAfterSnapshot = configChangesToReconcile.current.splice(0);
      const deferredSnapshot: ConfigChange[] = [];
      Object.entries(config).forEach(([key, value]) => {
        const change = { key, value };
        if (!applyConfigChange(change)) {
          deferredSnapshot.push(change);
        }
      });

      configChangesToReconcile.current.push(
        ...mergeDeferredConfigChanges(
          deferredSnapshot,
          eventsAfterSnapshot,
          applyConfigChange,
        ),
      );
      await reconcile();
    };

    configReconcilePromise.current = reconcile()
      .catch((error: unknown) => {
        configReconcileNeeded.current = true;
        // eslint-disable-next-line no-console
        console.warn("Config reconciliation failed:", error);
      })
      .finally(() => {
        configReconcilePromise.current = null;
        if (
          !configReconcileNeeded.current ||
          configReconcileRetry.current ||
          !canLoadProtectedConfig()
        ) {
          return;
        }
        configReconcileRetry.current = setTimeout(() => {
          configReconcileRetry.current = null;
          scheduleConfigReconcile();
        }, 1000);
      });
  });

  const handleConfigChanged = useMemoizedFn(
    (_event: unknown, data: ConfigChange) => {
      if (!data) return;
      if (isAppStoreKey(data.key)) {
        settingConfigWriter.recordRemoteValue(
          data.key,
          data.value as AppStore[typeof data.key],
        );
      }
      if (!initialConfigReady.current) {
        // The initial GET may currently be retrying. An apiKey SSE proves the
        // server has already committed that key, so use it immediately for
        // the next authenticated retry even if the HTTP write response was
        // lost and the coordinator has already cleared its pending state.
        if (data.key === "apiKey" && typeof data.value === "string") {
          setAppStore({ apiKey: data.value });
        } else {
          applyConfigChange(data);
        }
        bufferedConfigChanges.current.push(data);
        return;
      }
      if (configReconcilePromise.current) {
        configChangesToReconcile.current.push(data);
        configReconcileNeeded.current = true;
        return;
      }
      if (!applyConfigChange(data)) {
        configChangesToReconcile.current.push(data);
        scheduleConfigReconcile();
      }
    },
  );

  const onChangePrivacy = useMemoizedFn(() => {
    setBrowserStore({ url: "", title: "", mode: PageMode.Default });
  });

  useEffect(() => {
    const onUpdateAvailable = () => {
      setUpdateAvailable(true);
      setUploadChecking(false);
    };
    const onUpdateNotAvailable = () => {
      setUpdateAvailable(false);
      setUploadChecking(false);
    };
    const checkingForUpdate = () => {
      setUploadChecking(true);
    };
    const unsubConfig = onConfigChanged((...args: unknown[]) => {
      handleConfigChanged(args[0], args[1] as { key: string; value: unknown });
    });

    on("browser:privacyChanged", onChangePrivacy);
    on("update:available", onUpdateAvailable);
    on("update:notAvailable", onUpdateNotAvailable);
    on("update:checking", checkingForUpdate);

    return () => {
      unsubConfig();
      off("browser:privacyChanged", onChangePrivacy);
      off("update:available", onUpdateAvailable);
      off("update:notAvailable", onUpdateNotAvailable);
      off("update:checking", checkingForUpdate);
    };
  }, []);

  useEffect(() => {
    if (!adapterReady) return;
    tdApp.onEvent(PAGE_LOAD, {
      deviceId: useAppStore.getState().machineId || "",
    });
  }, [adapterReady]);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    initialConfigReady.current = false;

    const initialize = () => {
      void initializeAdapter().then((config) => {
        if (!active) return;
        setAdapterReady(true);

        if (!config) {
          if (!canLoadProtectedConfig()) return;
          retryTimer = setTimeout(initialize, 1000);
          return;
        }

        const bufferedChanges = bufferedConfigChanges.current.splice(0);
        const deferredSnapshot: ConfigChange[] = [];
        const initialValues: Partial<AppStore> = {};

        Object.entries(config).forEach(([key, value]) => {
          if (!isAppStoreKey(key)) return;
          const typedValue = value as AppStore[typeof key];
          const pending = settingConfigWriter.getPending(key);
          if (pending.pending) {
            settingConfigWriter.acknowledgeInFlightValue(key, typedValue);
            if (!settingConfigWriter.matchesPendingValue(key, typedValue)) {
              configReconcileNeeded.current = true;
              deferredSnapshot.push({ key, value });
            }
            return;
          }
          Object.assign(initialValues, { [key]: typedValue });
        });

        setAppStore(initialValues);
        configChangesToReconcile.current.push(
          ...mergeDeferredConfigChanges(
            deferredSnapshot,
            bufferedChanges,
            applyConfigChange,
          ),
        );
        initialConfigReady.current = true;
        if (configReconcileNeeded.current) scheduleConfigReconcile();
      });
    };

    initialize();

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [apiKey]);

  useEffect(
    () => () => {
      if (configReconcileRetry.current)
        clearTimeout(configReconcileRetry.current);
    },
    [],
  );

  useEffect(() => {
    const systemTheme = matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      setTheme(resolveAppTheme(appTheme, systemTheme.matches));
    };
    applyTheme();
    systemTheme.addEventListener("change", applyTheme);
    return () => systemTheme.removeEventListener("change", applyTheme);
  }, [appTheme, setTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  if (!adapterReady) return <AppBootScreen />;

  return (
    <>
      <div className="size-full overflow-hidden">
        <AuthGuard />
        <Routes>
          <Route
            path="/"
            element={
              <Suspense fallback={<AppBootScreen />}>
                <AppLayout />
              </Suspense>
            }
          >
            <Route
              index
              element={
                <Suspense fallback={<Loading />}>
                  <HomePage />
                </Suspense>
              }
            />
            <Route
              path="done"
              element={
                <Suspense fallback={<Loading />}>
                  <HomePage filter={DownloadFilter.done} />
                </Suspense>
              }
            />
            <Route
              path="source"
              element={
                <Suspense fallback={<Loading />}>
                  <SourceExtract />
                </Suspense>
              }
            />
            <Route
              path="settings"
              element={
                <Suspense fallback={<Loading />}>
                  <SettingPage />
                </Suspense>
              }
            />
            <Route
              path="converter"
              element={
                <Suspense fallback={<Loading />}>
                  <ConverterPage />
                </Suspense>
              }
            />

            <Route path="*" element={<div>404</div>} />
          </Route>
          <Route
            path="signin"
            element={
              <Suspense fallback={<Loading />}>
                <SigninPage />
              </Suspense>
            }
          />
          <Route
            path="/browser"
            element={
              <Suspense fallback={<Loading />}>
                <SourceExtract page={true} />
              </Suspense>
            }
          />
          <Route
            path="/download-dialog"
            element={
              <Suspense fallback={<Loading />}>
                <OverlayDialog />
              </Suspense>
            }
          />
        </Routes>
      </div>
      <Toaster theme={theme} richColors position="top-center" duration={2400} />
    </>
  );
};

export default App;

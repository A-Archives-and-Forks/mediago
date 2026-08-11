import { useEffect } from "react";
import { PageMode, useBrowserStore } from "../store/browser";
import { useSessionStore } from "../store/session";
import { usePlatform } from "./use-platform";

export function useDesktopEvents() {
  const { on, off } = usePlatform();
  const setUpdateAvailable = useSessionStore(
    (state) => state.setUpdateAvailable,
  );
  const setUploadChecking = useSessionStore((state) => state.setUploadChecking);
  const setBrowserStore = useBrowserStore((state) => state.setBrowserStore);

  useEffect(() => {
    const onPrivacyChanged = () => {
      setBrowserStore({ url: "", title: "", mode: PageMode.Default });
    };
    const onUpdateAvailable = () => {
      setUpdateAvailable(true);
      setUploadChecking(false);
    };
    const onUpdateNotAvailable = () => {
      setUpdateAvailable(false);
      setUploadChecking(false);
    };
    const onCheckingForUpdate = () => {
      setUploadChecking(true);
    };

    on("browser:privacyChanged", onPrivacyChanged);
    on("update:available", onUpdateAvailable);
    on("update:notAvailable", onUpdateNotAvailable);
    on("update:checking", onCheckingForUpdate);

    return () => {
      off("browser:privacyChanged", onPrivacyChanged);
      off("update:available", onUpdateAvailable);
      off("update:notAvailable", onUpdateNotAvailable);
      off("update:checking", onCheckingForUpdate);
    };
  }, []);
}

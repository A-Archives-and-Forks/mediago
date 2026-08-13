import type { UpdateState } from "@mediago/shared-common";
import { useEffect } from "react";
import { PageMode, useBrowserStore } from "../store/browser";
import { useSessionStore } from "../store/session";
import { usePlatform } from "./use-platform";

export function useDesktopEvents() {
  const { on, off, update } = usePlatform();
  const setUpdateState = useSessionStore((state) => state.setUpdateState);
  const setBrowserStore = useBrowserStore((state) => state.setBrowserStore);

  useEffect(() => {
    const onPrivacyChanged = () => {
      setBrowserStore({ url: "", title: "", mode: PageMode.Default });
    };
    const onUpdateStateChanged = (...args: unknown[]) => {
      const nextState = args[1] as UpdateState | undefined;
      if (nextState) setUpdateState(nextState);
    };

    on("browser:privacyChanged", onPrivacyChanged);
    on("update:stateChanged", onUpdateStateChanged);
    if (update?.getState) {
      void update
        .getState()
        .then(setUpdateState)
        .catch(() => undefined);
    }

    return () => {
      off("browser:privacyChanged", onPrivacyChanged);
      off("update:stateChanged", onUpdateStateChanged);
    };
  }, [off, on, setBrowserStore, setUpdateState, update]);
}

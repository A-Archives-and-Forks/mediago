import { useMemoizedFn } from "ahooks";
import { CircleAlert } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Spinner } from "@/components/ui/spinner";
import WebView from "@/components/web-view";
import { useBrowserActions } from "@/hooks/use-browser-actions";
import { usePlatform } from "@/hooks/use-platform";
import {
  BrowserStatus,
  browserErrorSelector,
  browserSourcePanelSelector,
  setBrowserSelector,
  type SourceData,
  useBrowserStore,
} from "@/store/browser";
import { BrowserViewPanel } from "./browser-view-panel";

export function BrowserView() {
  const { on, off } = usePlatform();
  const { goto, goHome } = useBrowserActions();
  const { status, errMsg, errCode } = useBrowserStore(
    useShallow(browserErrorSelector),
  );
  const { hasSources, sourcePanelCollapsed } = useBrowserStore(
    useShallow(browserSourcePanelSelector),
  );
  const url = useBrowserStore((s) => s.url);
  const { addSource } = useBrowserStore(useShallow(setBrowserSelector));
  const { t } = useTranslation();

  const onSourceDetected = useMemoizedFn((...args: unknown[]) => {
    addSource(args[1] as SourceData);
  });

  useEffect(() => {
    on("browser:sourceDetected", onSourceDetected);

    return () => {
      off("browser:sourceDetected", onSourceDetected);
    };
  }, [off, on, onSourceDetected]);

  const renderContent = useMemoizedFn(() => {
    // Loading or Loaded: show the WebView so the native WebContentsView is visible
    if (status === BrowserStatus.Loading || status === BrowserStatus.Loaded) {
      return (
        <div className="relative h-full w-full flex-1">
          <WebView
            className="h-full w-full flex-1"
            boundsInset={{ right: 1, bottom: 1, left: 1 }}
          />
          {status === BrowserStatus.Loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/40">
              <Spinner className="size-5" />
            </div>
          ) : null}
        </div>
      );
    }

    // Load failure
    if (status === BrowserStatus.Failed) {
      return (
        <div className="flex h-full w-full flex-row items-center justify-center">
          <Empty className="flex-none border-0 p-6 md:p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleAlert />
              </EmptyMedia>
              <EmptyDescription>
                {`${errMsg || t("loadFailed")} (${errCode})`}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex flex-row items-center gap-2">
                <Button onClick={goHome}>{t("backToHome")}</Button>
                <Button variant="outline" onClick={() => goto(url)}>
                  {t("refresh")}
                </Button>
              </div>
            </EmptyContent>
          </Empty>
        </div>
      );
    }

    return null;
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {!hasSources ? (
        renderContent()
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="h-full flex-1">
          <ResizablePanel className="min-w-0">{renderContent()}</ResizablePanel>
          {!sourcePanelCollapsed ? (
            <>
              <ResizableHandle withHandle className="mx-1" />
              <ResizablePanel minSize="20%" maxSize="70%" defaultSize={240}>
                <BrowserViewPanel />
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      )}
    </div>
  );
}

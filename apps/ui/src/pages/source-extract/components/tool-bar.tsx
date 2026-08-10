import { useMemoizedFn } from "ahooks";
import {
  ArrowLeft,
  Combine,
  EyeOff,
  House,
  Monitor,
  RefreshCw,
  Send,
  Smartphone,
  Star,
  X,
} from "lucide-react";
import { type KeyboardEvent, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { IconButton } from "@/components/icon-button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  appStoreSelector,
  setAppStoreSelector,
  useAppStore,
} from "@/store/app";
import {
  BrowserStatus,
  browserNavSelector,
  PageMode,
  setBrowserSelector,
  useBrowserStore,
} from "@/store/browser";
import { cn, getFavIcon } from "@/utils";
import { useBrowserActions } from "@/hooks/use-browser-actions";
import { useFavorites } from "@/hooks/use-favorites";
import { usePlatform } from "@/hooks/use-platform";

interface Props {
  page: boolean;
}

export function ToolBar({ page }: Props) {
  const { data: favoriteList, addFavorite, removeFavorite } = useFavorites();
  const { browser, app, contextMenu } = usePlatform();
  const { goto, goHome } = useBrowserActions();
  const store = useBrowserStore(useShallow(browserNavSelector));
  const { setBrowserStore } = useBrowserStore(useShallow(setBrowserSelector));
  const appStore = useAppStore(useShallow(appStoreSelector));
  const { setAppStore } = useAppStore(useShallow(setAppStoreSelector));
  const { t } = useTranslation();

  const disabled =
    store.status !== BrowserStatus.Loaded || store.mode !== PageMode.Browser;

  // Set default UA
  const onSetDefaultUA = useMemoizedFn(() => {
    const nextMode = !appStore.isMobile;
    browser.setUserAgent(nextMode);
    setAppStore({
      isMobile: nextMode,
    });
  });

  const curIsFavorite = useMemo(() => {
    return favoriteList.find((item) => item.url === store.url);
  }, [favoriteList, store.url]);

  const onInputKeyDown = useMemoizedFn(
    async (e: KeyboardEvent<HTMLInputElement>) => {
      if (!store.url || e.key !== "Enter") return;
      goto(store.url);
    },
  );

  const onClickGoBack = useMemoizedFn(async () => {
    const back = await browser.back();
    if (!back) {
      setBrowserStore({ url: "", title: "", mode: PageMode.Default });
    }
  });

  const onInputContextMenu = useMemoizedFn(() => {
    contextMenu.show([
      { key: "copy", label: t("copy") },
      { key: "paste", label: t("paste") },
    ]);
  });

  const onClickEnter = useMemoizedFn(() => {
    if (!store.url) return;
    goto(store.url);
  });

  const onClickAddFavorite = useMemoizedFn(async () => {
    if (curIsFavorite) {
      await removeFavorite(curIsFavorite.id);
    } else {
      const icon = getFavIcon(store.url);
      await addFavorite({
        url: store.url,
        title: store.title || store.url,
        icon,
      });
    }
  });

  const onCombineToHome = useMemoizedFn(() => {
    app.combineToHomePage({
      url: store.url,
      sourceList: [],
    });
  });

  return (
    <div
      className={cn(
        "flex flex-row items-center gap-2 bg-white px-3 py-2 dark:bg-[#1F2024]",
        {
          "rounded-lg": !page,
        },
      )}
    >
      <IconButton
        title={t("switchToMobileMode")}
        onClick={onSetDefaultUA}
        icon={appStore.isMobile ? <Smartphone /> : <Monitor />}
      />
      <IconButton
        disabled={disabled}
        title={t("home")}
        onClick={goHome}
        icon={<House />}
      />
      <IconButton
        disabled={store.mode === PageMode.Default}
        title={t("back")}
        onClick={onClickGoBack}
        icon={<ArrowLeft />}
      />
      {store.mode === PageMode.Browser &&
      store.status === BrowserStatus.Loading ? (
        <IconButton title={t("cancle")} onClick={goHome} icon={<X />} />
      ) : (
        <IconButton
          disabled={disabled}
          title={t("refresh")}
          onClick={() => goto(store.url)}
          icon={<RefreshCw />}
        />
      )}
      <IconButton
        title={curIsFavorite ? t("cancelFavorite") : t("favorite")}
        onClick={onClickAddFavorite}
        disabled={disabled}
        icon={<Star className={cn(curIsFavorite && "fill-current")} />}
      />
      <div className="relative min-w-0 flex-1">
        {appStore.privacy ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 items-center text-muted-foreground">
                  <EyeOff className="size-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{t("privacy")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        <Input
          key="url-input"
          className={cn("h-8", { "pl-9": appStore.privacy })}
          value={store.url}
          onChange={(e) => {
            const url = e.target.value;
            setBrowserStore({ url });
          }}
          onFocus={(e) => {
            e.currentTarget.select();
          }}
          onKeyDown={onInputKeyDown}
          onContextMenu={onInputContextMenu}
          placeholder={t("pleaseEnterUrl")}
        />
      </div>
      <IconButton
        title={t("visit")}
        onClick={onClickEnter}
        disabled={!store.url}
        icon={<Send />}
      />
      {page ? (
        <IconButton
          title={t("mergeToMainWindow")}
          onClick={onCombineToHome}
          icon={<Combine />}
        />
      ) : null}
    </div>
  );
}

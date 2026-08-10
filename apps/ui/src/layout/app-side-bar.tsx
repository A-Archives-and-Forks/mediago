import { useMemoizedFn } from "ahooks";
import {
  BadgeCheck,
  CloudDownload,
  ExternalLink,
  FileCog,
  ScanSearch,
  Settings,
} from "lucide-react";
import {
  cloneElement,
  type PropsWithChildren,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "@/components/ui/badge";
import { HelpButton } from "@/components/help-button";
import { useAppStore } from "@/store/app";
import { downloadStoreSelector, useDownloadStore } from "@/store/download";
import { useSessionStore } from "@/store/session";
import { cn, isWeb } from "@/utils";
import { usePlatform } from "@/hooks/use-platform";
import { AppBrand } from "./app-brand";

function processLocation(pathname: string) {
  const name = pathname === "/" ? "/home" : pathname;
  return name.substring(1);
}

type MenuItem = {
  label: ReactElement;
  key: string;
};

const SIDEBAR_HELP_BUTTON_CLASS =
  "h-9 justify-start gap-1 rounded-md px-3 text-sm font-normal text-muted-foreground hover:bg-surface-hover hover:text-foreground";

interface AppMenuItemProps extends PropsWithChildren {
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  link: string;
  activeKey: string;
  className?: string;
  icon?: ReactElement<{ className?: string }>;
}

function AppMenuItem({
  children,
  onClick,
  link,
  activeKey,
  className,
  icon,
}: AppMenuItemProps) {
  const isActive = activeKey === processLocation(link);

  return (
    <Link discover="render" to={link} onClick={onClick}>
      <div
        className={cn(
          "flex h-9 flex-row items-center gap-1 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground",
          {
            "bg-primary text-primary-foreground hover:bg-brand-hover hover:text-primary-foreground":
              isActive,
          },
          className,
        )}
      >
        {icon
          ? cloneElement(icon, {
              className: cn(
                "size-5 shrink-0 stroke-[1.75] text-current",
                icon.props.className,
              ),
            })
          : null}
        {children}
      </div>
    </Link>
  );
}

interface Props {
  className?: string;
}

export function AppSideBar({ className }: Props) {
  const { app } = usePlatform();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { count, clearCount } = useDownloadStore(
    useShallow(downloadStoreSelector),
  );
  const openInNewWindow = useAppStore((state) => state.openInNewWindow);
  const setAppStore = useAppStore((state) => state.setAppStore);
  const updateAvailable = useSessionStore((state) => state.updateAvailable);
  const previousOpenInNewWindow = useRef(openInNewWindow);

  const activeKey = useMemo(
    () => processLocation(location.pathname),
    [location.pathname],
  );

  useEffect(() => {
    const wasOpenInNewWindow = previousOpenInNewWindow.current;
    previousOpenInNewWindow.current = openInNewWindow;

    if (
      wasOpenInNewWindow &&
      !openInNewWindow &&
      location.pathname !== "/source"
    ) {
      navigate("/source", { replace: true });
    }
  }, [location.pathname, navigate, openInNewWindow]);

  const handleExternalLink = useMemoizedFn(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      event.preventDefault();

      if (openInNewWindow) {
        setAppStore({ openInNewWindow: false });
        await app.combineToHomePage({ url: "", sourceList: [] });
      } else {
        setAppStore({ openInNewWindow: true });
        if (location.pathname === "/source") {
          navigate("/", { replace: true });
        }
        await app.showBrowserWindow();
      }
    },
  );

  const handleClearCount = useMemoizedFn(() => {
    clearCount();
  });

  const handleExtractPage = useMemoizedFn(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!openInNewWindow) return;
      event.preventDefault();
      event.stopPropagation();
      app.showBrowserWindow();
    },
  );

  const items = useMemo<MenuItem[]>(
    () => [
      {
        label: (
          <AppMenuItem
            link="/"
            onClick={handleClearCount}
            activeKey={activeKey}
            icon={<CloudDownload />}
          >
            <span>{t("downloadList")}</span>
            {count > 0 ? (
              <Badge
                className="relative left-[5px] top-px h-4 min-w-4 border-0 bg-destructive px-1 py-0 text-[10px] leading-4 text-destructive-foreground"
                title={String(count)}
                aria-label={`${t("downloadList")}: ${count}`}
              >
                {count > 99 ? "99+" : count}
              </Badge>
            ) : null}
          </AppMenuItem>
        ),
        key: "home",
      },
      {
        label: (
          <AppMenuItem link="/done" activeKey={activeKey} icon={<BadgeCheck />}>
            <span>{t("downloadComplete")}</span>
          </AppMenuItem>
        ),
        key: "done",
      },
      {
        label: (
          <AppMenuItem
            link="/converter"
            activeKey={activeKey}
            icon={<FileCog />}
          >
            <span>{t("converter")}</span>
          </AppMenuItem>
        ),
        key: "converter",
      },
      {
        label: (
          <AppMenuItem
            link="/source"
            activeKey={activeKey}
            className="group"
            icon={<ScanSearch />}
            onClick={handleExtractPage}
          >
            <span className="flex flex-1">{t("materialExtraction")}</span>
            <div
              title={t(
                openInNewWindow ? "mergeToMainWindow" : "openInNewWindow",
              )}
              aria-label={t(
                openInNewWindow ? "mergeToMainWindow" : "openInNewWindow",
              )}
              className={cn(
                "hover:opacity-70",
                openInNewWindow ? "block" : "hidden group-hover:block",
              )}
              onClick={handleExternalLink}
            >
              <ExternalLink
                className={cn(
                  "size-5 shrink-0 stroke-[1.75] transition-transform",
                  openInNewWindow && "rotate-180",
                )}
              />
            </div>
          </AppMenuItem>
        ),
        key: "source",
      },
      {
        label: (
          <AppMenuItem
            link="/settings"
            activeKey={activeKey}
            icon={<Settings />}
          >
            <span>{t("setting")}</span>
            {updateAvailable ? (
              <span className="relative size-0">
                <Badge className="absolute -left-[13px] -top-[3px] size-1.5 border-0 bg-destructive p-0" />
              </span>
            ) : null}
          </AppMenuItem>
        ),
        key: "settings",
      },
    ],
    [
      activeKey,
      count,
      handleClearCount,
      handleExternalLink,
      handleExtractPage,
      location.pathname,
      openInNewWindow,
      t,
      updateAvailable,
    ],
  );

  const visibleItems = useMemo(
    () =>
      items.filter((item) =>
        isWeb ? item.key !== "source" && item.key !== "converter" : true,
      ),
    [items],
  );

  return (
    <aside
      className={cn(
        "relative flex shrink-0 flex-col overflow-hidden border-b bg-surface sm:h-full sm:w-[204px] sm:border-r sm:border-b-0",
        className,
      )}
    >
      <AppBrand />
      <nav className="min-h-0 overflow-x-auto p-3 sm:flex-1 sm:overflow-x-hidden sm:overflow-y-auto">
        <div className="flex min-w-max flex-row gap-2 sm:min-w-0 sm:flex-col">
          {visibleItems.map((item) =>
            cloneElement(item.label, { key: item.key }),
          )}
          <div className="sm:hidden">
            <HelpButton
              className={SIDEBAR_HELP_BUTTON_CLASS}
              iconClassName="size-5 stroke-[1.75]"
            />
          </div>
        </div>
      </nav>
      <div className="hidden shrink-0 border-t p-3 sm:block">
        <HelpButton
          className={cn(SIDEBAR_HELP_BUTTON_CLASS, "w-full")}
          iconClassName="size-5 stroke-[1.75]"
        />
      </div>
    </aside>
  );
}

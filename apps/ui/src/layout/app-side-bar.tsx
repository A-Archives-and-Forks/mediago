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
import siderBg from "@/assets/images/sider-bg.png";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app";
import { downloadStoreSelector, useDownloadStore } from "@/store/download";
import { useSessionStore } from "@/store/session";
import { cn, isWeb } from "@/utils";
import { usePlatform } from "@/hooks/use-platform";

function processLocation(pathname: string) {
  const name = pathname === "/" ? "/home" : pathname;
  return name.substring(1);
}

type MenuItem = {
  label: ReactElement;
  key: string;
};

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
          "flex h-10 flex-row items-center gap-1 rounded-lg bg-[#FAFCFF] px-3 text-sm text-[#636D7E] hover:bg-[#E1F0FF] hover:text-[#636D7E] dark:bg-[#2C2E33] dark:text-[rgba(255,255,255,0.85)] dark:hover:bg-[#3B3C41] dark:hover:text-[rgba(255,255,255,0.85)]",
          {
            "bg-linear-to-r from-[#127AF3] to-[#06D5FB] text-white hover:text-white dark:text-white":
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
                className="relative left-[5px] top-px h-4 min-w-4 border-0 bg-[#ff4d4f] px-1 py-0 text-[10px] leading-4 text-white"
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
                <Badge className="absolute -left-[13px] -top-[3px] size-1.5 border-0 bg-[#ff4d4f] p-0" />
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
    <div
      className={cn(
        "relative select-none bg-white p-3 dark:bg-[#1F2024]",
        className,
      )}
    >
      <div className="relative z-10 flex flex-row gap-3 sm:w-[180px] sm:flex-col">
        {visibleItems.map((item) =>
          cloneElement(item.label, { key: item.key }),
        )}
      </div>

      <img
        src={siderBg}
        alt=""
        className="pointer-events-none absolute bottom-0 left-0 right-0 w-full select-none"
      />
    </div>
  );
}

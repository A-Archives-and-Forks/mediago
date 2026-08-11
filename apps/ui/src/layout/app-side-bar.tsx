import { useMemoizedFn } from "ahooks";
import { ExternalLink, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { HelpButton } from "@/components/help-button";
import { Button } from "@/components/ui/button";
import { usePlatform } from "@/hooks/use-platform";
import { useAppStore } from "@/store/app";
import { useDownloadStore } from "@/store/download";
import { useSessionStore } from "@/store/session";
import { useShellStore } from "@/store/shell";
import { cn, isWeb } from "@/utils";
import { AppBrand } from "./app-brand";
import { useNavigationItems } from "./navigation";
import { ServerAccountMenu } from "./server-account-menu";

interface Props {
  className?: string;
}

export function AppSideBar({ className }: Props) {
  const { app } = usePlatform();
  const location = useLocation();
  const navigate = useNavigate();
  const items = useNavigationItems();
  const count = useDownloadStore((state) => state.count);
  const clearCount = useDownloadStore((state) => state.clearCount);
  const updateAvailable = useSessionStore((state) => state.updateAvailable);
  const openInNewWindow = useAppStore((state) => state.openInNewWindow);
  const setAppStore = useAppStore((state) => state.setAppStore);
  const collapsed = useShellStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useShellStore((state) => state.toggleSidebar);
  const previousOpenInNewWindow = useRef(openInNewWindow);

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

  const handleExternalLink = useMemoizedFn(async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (openInNewWindow) {
      setAppStore({ openInNewWindow: false });
      await app.combineToHomePage({ url: "", sourceList: [] });
      return;
    }
    setAppStore({ openInNewWindow: true });
    if (location.pathname === "/source") navigate("/", { replace: true });
    await app.showBrowserWindow();
  });

  const handleNavigation = useMemoizedFn(
    (event: React.MouseEvent<HTMLAnchorElement>, key: string) => {
      if (key === "home") clearCount();
      if (key !== "source" || !openInNewWindow) return;
      event.preventDefault();
      event.stopPropagation();
      void app.showBrowserWindow();
    },
  );

  const compact = collapsed;

  return (
    <aside
      className={cn(
        "relative my-3 ml-3 hidden shrink-0 flex-col overflow-hidden rounded-lg border bg-sidebar transition-[width] duration-200 min-[720px]:flex",
        compact ? "w-16" : "w-[204px] max-[1079px]:w-16",
        className,
      )}
    >
      <AppBrand
        collapsed={compact}
        className="max-[1079px]:justify-center max-[1079px]:px-2 max-[1079px]:[&>span]:hidden max-[1079px]:[&>img]:mr-0"
      />
      <nav className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 max-[1079px]:px-2">
        <div className="flex flex-col gap-2">
          {items.map(({ active, Icon, key, label, to }) => (
            <Link
              key={key}
              to={to}
              title={label}
              onClick={(event) => handleNavigation(event, key)}
              className={cn(
                "group relative flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground max-[1079px]:justify-center max-[1079px]:px-0",
                compact && "justify-center px-0",
                active &&
                  "bg-primary text-primary-foreground hover:bg-brand-hover hover:text-primary-foreground",
              )}
            >
              <span className="relative shrink-0">
                <Icon className="size-5 stroke-[1.75]" />
                {key === "settings" && updateAvailable ? (
                  <span className="absolute -right-1 -top-0.5 size-1.5 rounded-full bg-destructive" />
                ) : null}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate max-[1079px]:hidden",
                  compact && "hidden",
                )}
              >
                {label}
              </span>
              {key === "home" && count > 0 ? (
                <span
                  className={cn(
                    "min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 text-destructive-foreground max-[1079px]:absolute max-[1079px]:right-0 max-[1079px]:top-0",
                    compact && "absolute right-0 top-0",
                  )}
                >
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
              {key === "source" && !compact ? (
                <button
                  type="button"
                  title={
                    openInNewWindow
                      ? "Merge to main window"
                      : "Open in new window"
                  }
                  className="opacity-0 transition-opacity group-hover:opacity-100 max-[1079px]:hidden"
                  onClick={handleExternalLink}
                >
                  <ExternalLink
                    className={cn(
                      "size-4 stroke-[1.75]",
                      openInNewWindow && "rotate-180",
                    )}
                  />
                </button>
              ) : null}
            </Link>
          ))}
        </div>
      </nav>
      <div
        className={cn(
          "flex shrink-0 items-center gap-1 border-t p-3 max-[1079px]:flex-col max-[1079px]:px-2",
          compact && "flex-col px-2",
        )}
      >
        {isWeb ? (
          <div className="min-w-0 flex-1 max-[1079px]:flex-none">
            <ServerAccountMenu compact={compact} />
          </div>
        ) : null}
        <HelpButton
          iconOnly
          className="size-9 shrink-0 rounded-md p-0 text-muted-foreground"
          iconClassName="size-5 stroke-[1.75]"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="size-9 shrink-0 p-0 text-muted-foreground max-[1079px]:hidden"
          onClick={toggleSidebar}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5" strokeWidth={1.75} />
          ) : (
            <PanelLeftClose className="size-5" strokeWidth={1.75} />
          )}
        </Button>
      </div>
    </aside>
  );
}

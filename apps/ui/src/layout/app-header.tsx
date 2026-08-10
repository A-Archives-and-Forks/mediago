import { useMemoizedFn } from "ahooks";
import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils";
import LogoImg from "../assets/images/logo.png";
import { usePlatform } from "@/hooks/use-platform";

interface Props {
  className?: string;
}

export function AppHeader({ className }: Props) {
  const { shell } = usePlatform();
  const { t } = useTranslation();

  const openHelpUrl = useMemoizedFn(() => {
    const url = "https://downloader.caorushizi.cn/guides.html?form=client";
    shell.open(url);
  });

  return (
    <header
      className={cn(
        "flex h-16 w-full select-none flex-row justify-between border-b bg-surface",
        className,
      )}
    >
      <div className="flex h-full min-w-[299px] flex-row items-center px-4">
        <img className="mr-3 size-8" src={LogoImg} alt="Media Go" />
        <span className="text-lg font-semibold">Media Go</span>
        <span className="ml-4 text-sm text-muted-foreground">
          v{import.meta.env.APP_VERSION}
        </span>
      </div>
      <div className="flex items-center pr-3">
        <Button
          type="button"
          variant="ghost"
          className="text-brand hover:text-brand"
          onClick={openHelpUrl}
        >
          <CircleHelp />
          {t("help")}
        </Button>
      </div>
    </header>
  );
}

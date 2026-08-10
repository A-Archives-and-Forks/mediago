import { useMemoizedFn } from "ahooks";
import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { usePlatform } from "@/hooks/use-platform";
import { cn } from "@/utils";

const HELP_URL = "https://downloader.caorushizi.cn/guides.html?form=client";

export function HelpButton({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  const { shell } = usePlatform();
  const { t } = useTranslation();

  const openHelpUrl = useMemoizedFn(() => {
    shell.open(HELP_URL);
  });

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("shrink-0 text-brand hover:text-brand", className)}
      onClick={openHelpUrl}
    >
      <CircleHelp className={cn("size-4", iconClassName)} />
      {t("help")}
    </Button>
  );
}

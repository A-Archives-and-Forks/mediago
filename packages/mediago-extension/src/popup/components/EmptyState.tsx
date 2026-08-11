import { useTranslation } from "react-i18next";
import emptyResources from "@/assets/images/empty-resources.png";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  actionLabel: string;
  onAction: () => void;
}

export function EmptyState({ actionLabel, onAction }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      <img
        src={emptyResources}
        alt=""
        aria-hidden="true"
        className="h-24 w-28 object-contain"
      />
      <div className="font-serif text-[13px] leading-relaxed text-muted-foreground">
        <p>{t("empty.title")}</p>
        <p className="text-foreground/45">{t("empty.hint")}</p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

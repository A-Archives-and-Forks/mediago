import {
  CircleCheck,
  CircleX,
  ExternalLink,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { DESKTOP_HTTP_BASE } from "@/shared/constants";
import type { ExtensionSettings, ServerStatus } from "@/shared/types";

function shortHost(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

interface Props {
  status: ServerStatus | null;
  settings: ExtensionSettings | null;
}

export function StatusBadge({ status, settings }: Props) {
  const { t } = useTranslation();

  if (status === null || settings === null) {
    return (
      <Badge variant="outline" className="gap-1 normal-case tracking-normal">
        <Loader2 className="size-3 shrink-0 animate-spin" />
        {t("status.detecting")}
      </Badge>
    );
  }

  if (settings.mode === "desktop-schema") {
    return (
      <Badge variant="edit" className="gap-1 normal-case tracking-normal">
        <ExternalLink className="size-3 shrink-0" />
        {t("status.schemaMode")}
      </Badge>
    );
  }

  if (settings.mode === "docker-http" && !settings.serverUrl) {
    return (
      <Badge variant="warning" className="gap-1 normal-case tracking-normal">
        <TriangleAlert className="size-3 shrink-0" />
        {t("status.notConfigured")}
      </Badge>
    );
  }

  if (status.ok) {
    const host =
      settings.mode === "desktop-http"
        ? shortHost(DESKTOP_HTTP_BASE)
        : shortHost(settings.serverUrl);
    return (
      <Badge
        variant="success"
        className="gap-1 font-mono normal-case tracking-normal"
      >
        <CircleCheck className="size-3 shrink-0" />
        {host}
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="gap-1 normal-case tracking-normal">
      <CircleX className="size-3 shrink-0" />
      {t("status.connectionFailed")}
    </Badge>
  );
}

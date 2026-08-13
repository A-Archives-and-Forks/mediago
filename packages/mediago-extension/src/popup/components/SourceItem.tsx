import { DownloadType } from "@mediago/shared-common";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge, variantForDownloadType } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DetectedSource } from "@/shared/types";

interface Props {
  source: DetectedSource;
  onImport: (source: DetectedSource) => void;
  disabled: boolean;
}

export function SourceItem({ source, onImport, disabled }: Props) {
  const { t } = useTranslation();
  const inspecting = source.mediaInfo?.status === "inspecting";
  return (
    <li className="group relative flex items-start gap-2.5 rounded-lg border border-border bg-surface-100 p-3 transition-colors hover:border-ring">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <Badge variant={variantForDownloadType(source.type)}>
            {source.type === DownloadType.m3u8 ? "HLS" : source.type}
          </Badge>
          <span className="truncate text-[13px] font-medium tracking-tight">
            {source.name || t("source.unnamed")}
          </span>
        </div>
        {source.mediaInfo ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {source.mediaInfo.status === "inspecting" ? (
              <Badge variant="secondary" className="gap-1 normal-case">
                <LoaderCircle className="size-3 animate-spin" />
                {t("source.inspecting")}
              </Badge>
            ) : null}
            {source.mediaInfo.status !== "inspecting" &&
            source.mediaInfo.playlistType === "master" ? (
              <Badge variant="secondary" className="normal-case">
                {t("source.autoBest")}
              </Badge>
            ) : null}
            {source.mediaInfo.status !== "inspecting" ? (
              <Badge variant="outline" className="normal-case">
                {source.mediaInfo.maxQuality || t("source.qualityUnknown")}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
      <Button
        size="xs"
        variant="outline"
        disabled={disabled || inspecting}
        onClick={() => onImport(source)}
      >
        <ArrowUpRight className="size-3.5" />
        {t("source.import")}
      </Button>
    </li>
  );
}

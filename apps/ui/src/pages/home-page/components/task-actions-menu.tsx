import {
  DownloadStatus,
  type DownloadTaskWithFile,
} from "@mediago/shared-common";
import {
  CirclePlay,
  Download,
  ListChecks,
  MoreHorizontal,
  Pause,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  onDelete: () => void;
  onEdit: () => void;
  onPlay: () => void;
  onRefresh: () => void;
  onSelect: () => void;
  onStart: () => void;
  onStop: () => void;
  task: DownloadTaskWithFile;
}

export function TaskActionsMenu({
  onDelete,
  onEdit,
  onPlay,
  onRefresh,
  onSelect,
  onStart,
  onStop,
  task,
}: Props) {
  const { t } = useTranslation();
  const canRestart =
    task.status === DownloadStatus.Ready ||
    task.status === DownloadStatus.Failed ||
    task.status === DownloadStatus.Stopped;
  const canEdit = canRestart;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <MoreHorizontal />
          {t("actions")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onSelect={onSelect}>
          <ListChecks />
          {t("select")}
        </DropdownMenuItem>
        {canRestart ? (
          <DropdownMenuItem onSelect={onStart}>
            <Download />
            {task.status === DownloadStatus.Failed
              ? t("redownload")
              : task.status === DownloadStatus.Stopped
                ? t("continueDownload")
                : t("download")}
          </DropdownMenuItem>
        ) : null}
        {task.status === DownloadStatus.Downloading ? (
          <DropdownMenuItem onSelect={onStop}>
            <Pause />
            {t("pause")}
          </DropdownMenuItem>
        ) : null}
        {task.status === DownloadStatus.Success ? (
          <DropdownMenuItem disabled={!task.exists} onSelect={onPlay}>
            <CirclePlay />
            {t("playVideo")}
          </DropdownMenuItem>
        ) : null}
        {canEdit ? (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            {t("edit")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onRefresh}>
          <RefreshCw />
          {t("refresh")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

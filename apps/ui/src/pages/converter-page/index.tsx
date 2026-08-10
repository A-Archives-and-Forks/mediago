import { type Conversion } from "@mediago/shared-common";
import { useMemoizedFn } from "ahooks";
import {
  ArrowRight,
  FileQuestion,
  FolderOpen,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { IconButton } from "@/components/icon-button";
import PageContainer from "@/components/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { PaginationControl } from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ADD_CONVERT_TASK, DELETE_CONVERT, START_CONVERT } from "@/const";
import { tdApp } from "@/utils";
import { useConversions } from "@/hooks/use-conversions";
import { usePlatform } from "@/hooks/use-platform";
import Loading from "@/components/loading";

const FORMAT_OPTIONS = [
  // {
  //   label: "Video",
  //   options: [
  //     { label: "MP4", value: "mp4" },
  //     { label: "MKV", value: "mkv" },
  //     { label: "WebM", value: "webm" },
  //   ],
  // },
  {
    label: "Audio",
    options: [
      { label: "MP3", value: "mp3" },
      // { label: "AAC", value: "aac" },
      // { label: "FLAC", value: "flac" },
      // { label: "WAV", value: "wav" },
    ],
  },
];

const QUALITY_OPTIONS = [
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

const STATUS_STYLES: Record<
  string,
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  }
> = {
  pending: { variant: "secondary" },
  converting: { variant: "default" },
  done: {
    variant: "outline",
    className: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  },
  failed: { variant: "destructive" },
};

const Converter = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const {
    data,
    isLoading,
    mutate,
    addConversion,
    deleteConversion,
    startConversion,
    stopConversion,
  } = useConversions({ current: page, pageSize });
  const { dialog, shell } = usePlatform();
  const [outputFormat, setOutputFormat] = useState("mp3");
  const [quality, setQuality] = useState("medium");
  const [filePath, setFilePath] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);

  const handleBrowseFile = useMemoizedFn(async () => {
    try {
      const paths = await dialog.open({ type: "file" });
      const file = paths?.[0];
      if (file) setFilePath(file);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  });

  const handleOpenModal = useMemoizedFn(() => {
    setFilePath("");
    setAddModalOpen(true);
  });

  const doAddConversion = useMemoizedFn(async (startImmediately: boolean) => {
    if (!filePath) {
      toast.warning(t("pleaseSelectFile"));
      return;
    }
    try {
      const name = filePath.split(/[/\\]/).pop() || filePath;
      const conv = await addConversion({
        name,
        path: filePath,
        outputFormat,
        quality,
      });
      tdApp.onEvent(ADD_CONVERT_TASK);
      if (startImmediately && conv.id) {
        await startConversion(conv.id);
      }
      setAddModalOpen(false);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  });

  const handleStart = useMemoizedFn(async (id: number) => {
    tdApp.onEvent(START_CONVERT);
    try {
      await startConversion(id);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  });

  const handleStop = useMemoizedFn(async (id: number) => {
    try {
      await stopConversion(id);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  });

  const handleDelete = useMemoizedFn(async (id: number) => {
    tdApp.onEvent(DELETE_CONVERT);
    await deleteConversion(id);
  });

  const handleOpenFolder = useMemoizedFn(async (targetPath: string) => {
    try {
      const dir =
        targetPath.substring(0, targetPath.lastIndexOf("/")) ||
        targetPath.substring(0, targetPath.lastIndexOf("\\"));
      await shell.open(dir || targetPath);
    } catch {
      // ignore
    }
  });

  const handleConvertAll = useMemoizedFn(async () => {
    if (!data?.list) return;
    const pending = data.list.filter(
      (item: Conversion) =>
        item.status === "pending" || item.status === "failed",
    );
    await Promise.allSettled(pending.map((item) => startConversion(item.id)));
    mutate();
  });

  const renderActions = useMemoizedFn((item: Conversion) => {
    switch (item.status) {
      case "converting":
        return (
          <div title={t("stop")} onClick={() => handleStop(item.id)}>
            <IconButton icon={<Pause className="size-4" />} />
          </div>
        );
      case "done":
        return (
          <>
            {item.outputPath && (
              <div
                title={t("openFolder")}
                onClick={() => handleOpenFolder(item.outputPath)}
              >
                <IconButton icon={<FolderOpen className="size-4" />} />
              </div>
            )}
            <div title={t("delete")} onClick={() => handleDelete(item.id)}>
              <IconButton icon={<Trash2 className="size-4" />} />
            </div>
          </>
        );
      default:
        return (
          <>
            <div title={t("start")} onClick={() => handleStart(item.id)}>
              <IconButton icon={<Play className="size-4" />} />
            </div>
            <div title={t("delete")} onClick={() => handleDelete(item.id)}>
              <IconButton icon={<Trash2 className="size-4" />} />
            </div>
          </>
        );
    }
  });

  const hasPending =
    data?.list?.some(
      (item: Conversion) =>
        item.status === "pending" || item.status === "failed",
    ) ?? false;

  return (
    <PageContainer
      title={t("converter")}
      rightExtra={
        <div className="flex items-center gap-2">
          {hasPending ? (
            <Button variant="outline" onClick={handleConvertAll}>
              {t("convertAll")}
            </Button>
          ) : null}
          <Button onClick={handleOpenModal}>{t("addFile")}</Button>
        </div>
      }
      className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3"
    >
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addFile")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("pleaseSelectFile")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="conversion-file">
                {t("filePath")}
              </label>
              <div className="flex w-full">
                <Input
                  id="conversion-file"
                  className="rounded-r-none"
                  value={filePath}
                  readOnly
                  placeholder={t("pleaseSelectFile")}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-l-none border-l-0"
                  onClick={handleBrowseFile}
                >
                  {t("browse")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="output-format">
                {t("outputFormat")}
              </label>
              <Select value={outputFormat} onValueChange={setOutputFormat}>
                <SelectTrigger id="output-format" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.flatMap((group) => group.options).map(
                    (option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="quality">
                {t("quality")}
              </label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger id="quality" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUALITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => doAddConversion(false)}
            >
              {t("addToList")}
            </Button>
            <Button type="button" onClick={() => doAddConversion(true)}>
              {t("convertNow")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {isLoading ? <Loading /> : null}
        {!isLoading && data?.list?.length === 0 ? (
          <div className="flex h-full flex-1 flex-row items-center justify-center">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileQuestion />
                </EmptyMedia>
                <EmptyDescription>{t("noData")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : null}
        {!isLoading &&
          Array.isArray(data?.list) &&
          data.list.length > 0 &&
          data.list.map((item: Conversion) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 border-b px-1 py-3 last:border-b-0"
            >
              <div className="flex flex-row items-center justify-between">
                <div className="flex flex-row items-center gap-2">
                  <span className="text-sm text-foreground">{item.name}</span>
                  <Badge
                    variant={STATUS_STYLES[item.status]?.variant ?? "secondary"}
                    className={STATUS_STYLES[item.status]?.className}
                  >
                    {item.status === "converting"
                      ? `${item.progress}%`
                      : item.status}
                  </Badge>
                  {item.outputFormat && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <ArrowRight className="size-3 shrink-0 stroke-[1.75]" />.
                      {item.outputFormat}
                    </span>
                  )}
                </div>
                <div className="flex flex-row gap-3">{renderActions(item)}</div>
              </div>
              {item.status === "converting" && (
                <Progress value={item.progress} className="h-1.5" />
              )}
              <div className="text-xs text-muted-foreground">
                {item.status === "done" && item.outputPath
                  ? item.outputPath
                  : item.path}
              </div>
              {item.status === "failed" && item.error && (
                <div className="text-xs text-red-500">{item.error}</div>
              )}
            </div>
          ))}
      </div>

      <PaginationControl
        className="justify-end"
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        isLoading={isLoading}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPage(1);
          setPageSize(size);
        }}
      />
    </PageContainer>
  );
};

export default Converter;

import { useAsyncEffect, useMemoizedFn } from "ahooks";
import { ChevronDown, Container, Download, ListPlus } from "lucide-react";
import {
  forwardRef,
  type ReactNode,
  useId,
  useImperativeHandle,
  useState,
} from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { createDownloadTasks, getDownloadFolders } from "@/api/download-task";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ADD_TO_LIST, DOWNLOAD_NOW } from "@/const";
import { useDockerApi } from "@/hooks/use-docker-api";
import { usePlatform } from "@/hooks/use-platform";
import { appStoreSelector, useAppStore } from "@/store/app";
import { downloadFormSelector, useConfigStore } from "@/store/config";
import { cn, tdApp } from "@/utils";
import { DownloadTask, DownloadType } from "@mediago/shared-common";
import { BatchUrlTextarea } from "./batchurl-textarea";

export interface DownloadFormItem {
  batch?: boolean;
  batchList?: string;
  name?: string;
  type?: DownloadType;
  headers?: string;
  url?: string;
  id?: number;
  folder?: string;
}

export interface DownloadFormProps {
  isEdit?: boolean;
  onFormVisibleChange?: (open: boolean) => void;
  onConfirm?: (values: DownloadFormItem) => void;
  id: string;
}

export interface DownloadFormRef {
  setFieldsValue: (value: DownloadFormItem) => void;
  getFieldsValue: () => DownloadFormItem;
  openModal: (value: DownloadFormItem) => void;
}

export interface DownloadTaskForm extends DownloadTask {
  batch?: boolean;
  batchList?: string;
}

const DOWNLOAD_TYPE_OPTIONS = [
  { value: DownloadType.m3u8, labelKey: "streamMedia" },
  { value: DownloadType.bilibili, labelKey: "bilibiliMedia" },
  { value: DownloadType.youtube, labelKey: "youtubeMedia" },
  { value: DownloadType.direct, labelKey: "direct" },
  { value: DownloadType.mediago, labelKey: "mediagoMedia" },
] as const;

interface FormRowProps {
  children: ReactNode;
  error?: string;
  errorId?: string;
  htmlFor: string;
  label: ReactNode;
  required?: boolean;
}

function FormRow({
  children,
  error,
  errorId,
  htmlFor,
  label,
  required,
}: FormRowProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-destructive">
            *
          </span>
        ) : null}
      </label>
      <div className="min-w-0 space-y-2">
        {children}
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default forwardRef<DownloadFormRef, DownloadFormProps>(
  function DownloadForm({ isEdit, onFormVisibleChange, id, onConfirm }, ref) {
    const { enableDocker } = useAppStore(useShallow(appStoreSelector));
    const [modalOpen, setModalOpen] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const formId = useId();
    const { t } = useTranslation();
    const { setLastDownloadTypes, setLastIsBatch } = useConfigStore(
      useShallow(downloadFormSelector),
    );
    const [videoFolders, setVideoFolders] = useState<string[]>([]);
    const { contextMenu } = usePlatform();
    const { addVideosToDocker } = useDockerApi();
    const form = useForm<DownloadFormItem>({
      defaultValues: {
        batch: false,
        batchList: "",
        folder: "",
        headers: "",
        name: "",
        type: DownloadType.m3u8,
        url: "",
      },
    });
    const isBatch = useWatch({ control: form.control, name: "batch" });
    const selectedType = useWatch({ control: form.control, name: "type" });

    useAsyncEffect(async () => {
      if (!modalOpen) return;
      try {
        const fetchedFolders = await getDownloadFolders();
        if (Array.isArray(fetchedFolders)) setVideoFolders(fetchedFolders);
      } catch {
        // Go Core may not be ready yet, ignore.
      }
    }, [modalOpen]);

    const setOpen = useMemoizedFn((open: boolean) => {
      setModalOpen(open);
      onFormVisibleChange?.(open);
      if (!open) {
        form.reset();
        setAdvancedOpen(false);
      }
    });

    useImperativeHandle(
      ref,
      () => ({
        openModal: (value) => {
          form.reset(value);
          setAdvancedOpen(
            Boolean(value.folder?.trim() || value.headers?.trim()),
          );
          setOpen(true);
        },
        setFieldsValue: (value) => {
          form.reset({ ...form.getValues(), ...value });
        },
        getFieldsValue: () => form.getValues(),
      }),
      [form, setOpen],
    );

    const showTextMenu = useMemoizedFn(() => {
      contextMenu.show([
        { key: "copy", label: t("copy") },
        { key: "paste", label: t("paste") },
      ]);
    });

    const validateForm = useMemoizedFn(async () => form.trigger());

    const getFormItems = useMemoizedFn(async () => {
      const values = form.getValues();
      if (values.batch) {
        const { batchList = "", headers, type = DownloadType.m3u8 } = values;
        return Promise.all(
          batchList.split("\n").map(async (line) => {
            const [url, customName, folder] = line.trim().split(" ");
            return {
              url: url.trim(),
              name: customName?.trim(),
              headers,
              type,
              folder,
            } satisfies Omit<DownloadTask, "id">;
          }),
        );
      }

      const {
        name = "",
        url = "",
        headers,
        type = DownloadType.m3u8,
        folder,
      } = values;
      return [{ name, url, headers, type, folder }];
    });

    const handleSave = useMemoizedFn(async () => {
      if (!(await validateForm())) return;
      try {
        const tasks = await getFormItems();
        await createDownloadTasks(tasks);
        const values = form.getValues();
        setOpen(false);
        onConfirm?.(values);
        tdApp.onEvent(ADD_TO_LIST, { id });
      } catch (error: unknown) {
        toast.error(
          (error as Error)?.message || t("pleaseEnterCorrectFormInfo"),
        );
      }
    });

    const handleAddToDocker = useMemoizedFn(async () => {
      if (!(await validateForm())) return;
      try {
        await addVideosToDocker({ items: await getFormItems() });
        toast.success(t("addToDockerSuccess"));
      } catch (error: unknown) {
        toast.error(
          (error as Error)?.message || t("pleaseEnterCorrectFormInfo"),
        );
      }
    });

    const handleDownloadNow = useMemoizedFn(async () => {
      if (!(await validateForm())) return;
      try {
        const tasks = await getFormItems();
        await createDownloadTasks(tasks, true);
        const values = form.getValues();
        setOpen(false);
        onConfirm?.(values);
        tdApp.onEvent(DOWNLOAD_NOW, { id });
      } catch (error: unknown) {
        toast.error(
          (error as Error)?.message || t("pleaseEnterCorrectFormInfo"),
        );
      }
    });

    return (
      <Dialog open={modalOpen} onOpenChange={setOpen}>
        <DialogContent className="grid max-h-[calc(100vh-2rem)] max-w-[560px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-5 pr-14">
            <DialogTitle>
              {isEdit ? t("editDownload") : t("newDownload")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("pleaseEnterCorrectFormInfo")}
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-5 overflow-y-auto px-6 py-5"
            onSubmit={(event) => event.preventDefault()}
          >
            <input
              type="hidden"
              {...form.register("id", { valueAsNumber: true })}
            />

            {!isEdit ? (
              <FormRow
                htmlFor={`${formId}-single-mode`}
                label={t("downloadMode")}
              >
                <Controller
                  control={form.control}
                  name="batch"
                  render={({ field }) => {
                    const batchMode = Boolean(field.value);
                    const selectMode = (nextBatchMode: boolean) => {
                      field.onChange(nextBatchMode);
                      setLastIsBatch(nextBatchMode);
                    };

                    return (
                      <div
                        role="group"
                        aria-label={t("downloadMode")}
                        className="grid grid-cols-2 rounded-md bg-surface-subtle p-1"
                      >
                        <button
                          id={`${formId}-single-mode`}
                          type="button"
                          aria-pressed={!batchMode}
                          onClick={() => selectMode(false)}
                          className={cn(
                            "h-8 rounded-sm px-3 text-sm font-medium text-muted-foreground outline-none transition-[background-color,color,box-shadow] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/15",
                            !batchMode &&
                              "bg-surface text-foreground shadow-sm",
                          )}
                        >
                          {t("singleDownload")}
                        </button>
                        <button
                          type="button"
                          aria-pressed={batchMode}
                          onClick={() => selectMode(true)}
                          className={cn(
                            "h-8 rounded-sm px-3 text-sm font-medium text-muted-foreground outline-none transition-[background-color,color,box-shadow] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/15",
                            batchMode && "bg-surface text-foreground shadow-sm",
                          )}
                        >
                          {t("batchDownload")}
                        </button>
                      </div>
                    );
                  }}
                />
              </FormRow>
            ) : null}

            <FormRow
              errorId={`${formId}-type-error`}
              htmlFor={`${formId}-type`}
              label={t("videoType")}
              required
              error={form.formState.errors.type?.message}
            >
              <Controller
                control={form.control}
                name="type"
                rules={{ required: t("pleaseEnterVideoName") }}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    disabled={isEdit}
                    onValueChange={(value) => {
                      const type = value as DownloadType;
                      field.onChange(type);
                      setLastDownloadTypes(type);
                    }}
                  >
                    <SelectTrigger
                      id={`${formId}-type`}
                      className="w-full"
                      aria-invalid={Boolean(form.formState.errors.type)}
                      aria-describedby={
                        form.formState.errors.type
                          ? `${formId}-type-error`
                          : undefined
                      }
                    >
                      <SelectValue placeholder={t("pleaseSelectVideoType")} />
                    </SelectTrigger>
                    <SelectContent>
                      {DOWNLOAD_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormRow>

            {!isBatch ? (
              <FormRow
                errorId={`${formId}-name-error`}
                htmlFor={`${formId}-name`}
                label={t("videoName")}
                required={selectedType !== DownloadType.bilibili}
                error={form.formState.errors.name?.message}
              >
                <Input
                  id={`${formId}-name`}
                  placeholder={t("pleaseEnterVideoName")}
                  onContextMenu={showTextMenu}
                  aria-invalid={Boolean(form.formState.errors.name)}
                  aria-describedby={
                    form.formState.errors.name
                      ? `${formId}-name-error`
                      : undefined
                  }
                  {...form.register("name", {
                    validate: (value) =>
                      isBatch ||
                      selectedType === DownloadType.bilibili ||
                      value?.trim()
                        ? true
                        : t("pleaseEnterCorrectFormInfo"),
                  })}
                />
              </FormRow>
            ) : null}

            {isBatch && !isEdit ? (
              <FormRow
                errorId={`${formId}-batch-list-error`}
                htmlFor={`${formId}-batch-list`}
                label={t("videoLink")}
                required
                error={form.formState.errors.batchList?.message}
              >
                <Controller
                  control={form.control}
                  name="batchList"
                  rules={{
                    validate: (value) => {
                      if (!isBatch || isEdit) return true;
                      if (!value?.trim()) return t("pleaseEnterVideoLink");
                      for (const line of value.split("\n")) {
                        const params = line.trim().split(" ");
                        if (
                          params.length > 3 ||
                          !/^(https?):\/\/.+/.test(params[0] ?? "")
                        ) {
                          return t("pleaseEnterCorrectBatchList");
                        }
                      }
                      return true;
                    },
                  }}
                  render={({ field }) => (
                    <BatchUrlTextarea
                      {...field}
                      id={`${formId}-batch-list`}
                      value={field.value ?? ""}
                      rows={5}
                      placeholder={t("pleaseEnterVideoLink")}
                      onContextMenu={showTextMenu}
                      aria-invalid={Boolean(form.formState.errors.batchList)}
                      aria-describedby={
                        form.formState.errors.batchList
                          ? `${formId}-batch-list-error ${formId}-batch-list-help`
                          : `${formId}-batch-list-help`
                      }
                    />
                  )}
                />
                <p
                  id={`${formId}-batch-list-help`}
                  className="text-xs leading-relaxed text-muted-foreground"
                >
                  {t("batchListHelp")}
                </p>
              </FormRow>
            ) : null}

            {!isBatch || isEdit ? (
              <FormRow
                errorId={`${formId}-url-error`}
                htmlFor={`${formId}-url`}
                label={t("videoLink")}
                required
                error={form.formState.errors.url?.message}
              >
                <Input
                  id={`${formId}-url`}
                  placeholder={t("pleaseEnterOnlineVideoUrlOrDragM3U8Here")}
                  onContextMenu={showTextMenu}
                  aria-invalid={Boolean(form.formState.errors.url)}
                  aria-describedby={
                    form.formState.errors.url
                      ? `${formId}-url-error`
                      : undefined
                  }
                  {...form.register("url", {
                    validate: (value) => {
                      if (isBatch && !isEdit) return true;
                      if (!value?.trim()) return t("pleaseEnterOnlineVideoUrl");
                      return /^(file|https?):\/\/.+/.test(value)
                        ? true
                        : t("pleaseEnterCorrectVideoLink");
                    },
                  })}
                  onDrop={(event) => {
                    const file = event.dataTransfer.files[0] as
                      | (File & { path?: string })
                      | undefined;
                    if (!file?.path) return;
                    form.setValue("url", `file://${file.path}`, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                />
              </FormRow>
            ) : null}

            <details
              open={advancedOpen}
              onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
              className="group overflow-hidden rounded-md border border-border/70 bg-surface-subtle/40"
            >
              <summary className="flex h-10 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/15 [&::-webkit-details-marker]:hidden">
                <span>{t("moreSettings")}</span>
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-5 border-t bg-surface px-4 py-4">
                {!isBatch ? (
                  <FormRow htmlFor={`${formId}-folder`} label={t("folder")}>
                    <Input
                      id={`${formId}-folder`}
                      list={`${formId}-folder-options`}
                      placeholder={t("pleaseInputVideoFolder")}
                      {...form.register("folder")}
                    />
                    <datalist id={`${formId}-folder-options`}>
                      {videoFolders.map((folder) => (
                        <option key={folder} value={folder} />
                      ))}
                    </datalist>
                  </FormRow>
                ) : null}

                {selectedType === DownloadType.m3u8 ||
                selectedType === DownloadType.mediago ||
                isBatch ? (
                  <FormRow
                    htmlFor={`${formId}-headers`}
                    label={t("additionalHeaders")}
                  >
                    <Textarea
                      id={`${formId}-headers`}
                      rows={4}
                      placeholder="Origin: https://example.com"
                      onContextMenu={showTextMenu}
                      aria-describedby={`${formId}-headers-help`}
                      {...form.register("headers")}
                    />
                    <p
                      id={`${formId}-headers-help`}
                      className="text-xs leading-relaxed text-muted-foreground"
                    >
                      {t("additionalHeadersHelp")}
                    </p>
                  </FormRow>
                ) : null}
              </div>
            </details>
          </form>

          <DialogFooter className="border-t bg-surface-subtle/60 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              {enableDocker ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddToDocker}
                >
                  <Container className="size-4" />
                  {t("addToDocker")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={handleSave}>
                <ListPlus className="size-4" />
                {t("addToList")}
              </Button>
              <Button type="button" onClick={handleDownloadNow}>
                <Download className="size-4" />
                {t("downloadNow")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);

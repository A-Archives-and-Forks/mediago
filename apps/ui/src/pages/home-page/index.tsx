import { DownloadFilter } from "@mediago/shared-common";
import { useMemoizedFn } from "ahooks";
import { FolderOpen, QrCodeIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { type FC, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import DownloadForm, {
  type DownloadFormItem,
  type DownloadFormRef,
} from "@/components/download-form";
import { HomeDownloadButton } from "@/components/home-download-button";
import PageContainer from "@/components/page-container";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { PaginationControl } from "@/components/ui/pagination";
import { CLICK_DOWNLOAD } from "@/const";
import { usePlatform } from "@/hooks/use-platform";
import { useEnvPath } from "@/hooks/use-config";
import { useTasks } from "@/hooks/use-tasks";
import { appStoreSelector, useAppStore } from "@/store/app";
import { downloadFormSelector, useConfigStore } from "@/store/config";
import { isWeb, tdApp } from "@/utils";
import { DownloadList } from "./components/download-list";
import { useUrlInvoke } from "@/hooks/use-url-invoke";

interface Props {
  filter?: DownloadFilter;
}

const HomePage: FC<Props> = ({ filter = DownloadFilter.list }) => {
  const { shell } = usePlatform();
  const appStore = useAppStore(useShallow(appStoreSelector));
  const { t } = useTranslation();
  const newFormRef = useRef<DownloadFormRef>(null);
  const homeId = useId();
  const { lastIsBatch, lastDownloadTypes } = useConfigStore(
    useShallow(downloadFormSelector),
  );

  const { data, isLoading, pagination, total, mutate, setPage, setPageSize } =
    useTasks(filter);
  const { envPath } = useEnvPath();

  useUrlInvoke({
    onOpenForm: (item: DownloadFormItem) => {
      newFormRef.current?.openModal(item);
    },
    refresh: () => {
      mutate();
    },
  });

  const handleOpenForm = useMemoizedFn(() => {
    tdApp.onEvent(CLICK_DOWNLOAD);
    const item: DownloadFormItem = {
      batch: lastIsBatch,
      type: lastDownloadTypes,
    };
    newFormRef.current?.openModal(item);
  });

  const handleConfirm = useMemoizedFn(async () => {
    mutate();
  });

  return (
    <PageContainer
      title={
        filter === DownloadFilter.list
          ? t("downloadList")
          : t("downloadComplete")
      }
      rightExtra={
        <div className="flex flex-row gap-2">
          {!isWeb && (
            <Button
              variant="outline"
              onClick={() => shell.open(appStore.local)}
            >
              <FolderOpen />
              {t("openFolder")}
            </Button>
          )}
          {filter === DownloadFilter.done &&
            !isWeb &&
            appStore.enableMobilePlayer && (
              <HoverCard openDelay={100} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <Button variant="outline">
                    <QrCodeIcon />
                    {t("playOnMobile")}
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent align="end" className="w-auto">
                  <div className="bg-white p-3">
                    <QRCodeSVG value={envPath?.playerUrl || ""} size={136} />
                  </div>
                  <div className="mt-2 text-xs">{t("scanToWatch")}</div>
                </HoverCardContent>
              </HoverCard>
            )}
          {filter === DownloadFilter.list && (
            <HomeDownloadButton onClick={handleOpenForm} />
          )}
        </div>
      }
      className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3"
    >
      <DownloadList
        key={filter + ":" + pagination.page + ":" + pagination.pageSize}
        filter={filter}
        data={data}
        isLoading={isLoading}
        mutate={mutate}
      />

      <PaginationControl
        className="flex justify-end"
        page={pagination.page}
        pageSize={pagination.pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        total={total}
        isLoading={isLoading}
      />

      <DownloadForm id={homeId} ref={newFormRef} onConfirm={handleConfirm} />
    </PageContainer>
  );
};

export default HomePage;

import { useMemoizedFn } from "ahooks";
import { memo, startTransition, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageContainer from "@/components/page-container";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CHECK_UPDATE } from "@/const";
import { usePlatform } from "@/hooks/use-platform";
import { useSessionStore } from "@/store/session";
import { isWeb, tdApp } from "@/utils";
import { SettingsFormProvider } from "./setting-fields";
import {
  BasicSettingsCard,
  BrowserExtensionCard,
  BrowserSettingsCard,
  DockerSettingsCard,
  DownloadSettingsCard,
  MoreSettingsCard,
  SkillsSettingsCard,
} from "./setting-sections";

const StableBasicSettingsCard = memo(BasicSettingsCard);
const StableBrowserSettingsCard = memo(BrowserSettingsCard);
const StableDownloadSettingsCard = memo(DownloadSettingsCard);
const StableDockerSettingsCard = memo(DockerSettingsCard);
const StableSkillsSettingsCard = memo(SkillsSettingsCard);
const StableBrowserExtensionCard = memo(BrowserExtensionCard);
const StableMoreSettingsCard = memo(MoreSettingsCard);
const SETTINGS_REVEAL_STEPS = isWeb ? 2 : 4;

const SettingsCards = memo(function SettingsCards({
  onCheckUpdate,
}: {
  onCheckUpdate: () => void;
}) {
  const [visibleStep, setVisibleStep] = useState(1);

  useEffect(() => {
    let nextStep = 2;
    let frame = 0;
    const revealNext = () => {
      startTransition(() => setVisibleStep(nextStep));
      nextStep += 1;
      if (nextStep <= SETTINGS_REVEAL_STEPS) {
        frame = window.requestAnimationFrame(revealNext);
      }
    };

    frame = window.requestAnimationFrame(revealNext);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="mx-auto grid w-full max-w-[1280px] grid-cols-[repeat(auto-fit,minmax(min(100%,430px),1fr))] items-start gap-4">
      <div className="flex min-w-0 flex-col gap-4">
        <StableBasicSettingsCard />
        {!isWeb && visibleStep >= 2 ? <StableBrowserSettingsCard /> : null}
        {visibleStep >= (isWeb ? 2 : 3) ? <StableDownloadSettingsCard /> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        {!isWeb ? <StableDockerSettingsCard /> : <StableSkillsSettingsCard />}
        {!isWeb && visibleStep >= 2 ? <StableSkillsSettingsCard /> : null}
        {!isWeb && visibleStep >= 3 ? <StableBrowserExtensionCard /> : null}
        {visibleStep >= (isWeb ? 2 : 4) ? (
          <StableMoreSettingsCard onCheckUpdate={onCheckUpdate} />
        ) : null}
      </div>
    </div>
  );
});

const SettingsContent = memo(function SettingsContent({
  onCheckUpdate,
}: {
  onCheckUpdate: () => void;
}) {
  return (
    <SettingsFormProvider>
      <div className="h-full min-h-0 overflow-x-hidden overflow-y-auto p-4">
        <SettingsCards onCheckUpdate={onCheckUpdate} />
      </div>
    </SettingsFormProvider>
  );
});

const SettingPage = () => {
  const { update, on, off } = usePlatform();
  const { t } = useTranslation();
  const updateAvailable = useSessionStore((state) => state.updateAvailable);
  const updateChecking = useSessionStore((state) => state.updateChecking);
  const [openUpdateModal, setOpenUpdateModal] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);

  const handleCheckUpdate = useMemoizedFn(async () => {
    tdApp.onEvent(CHECK_UPDATE);
    setOpenUpdateModal(true);
    await update.check();
  });

  const handleHiddenUpdateModal = useMemoizedFn(() => {
    setOpenUpdateModal(false);
  });

  const handleUpdate = useMemoizedFn(() => {
    update.startDownload();
  });

  const handleInstallUpdate = useMemoizedFn(() => {
    update.install();
  });

  useEffect(() => {
    const onDownloadProgress = (...args: unknown[]) => {
      const progress = args[1] as { percent: number };
      setDownloadProgress(progress.percent);
    };
    const onDownloaded = () => {
      setUpdateDownloaded(true);
    };
    on("update:downloadProgress", onDownloadProgress);
    on("update:downloaded", onDownloaded);

    return () => {
      off("update:downloadProgress", onDownloadProgress);
      off("update:downloaded", onDownloaded);
    };
  }, [off, on]);

  const displayedDownloadProgress = updateDownloaded ? 100 : downloadProgress;

  return (
    <PageContainer title={t("setting")} className="overflow-hidden p-0">
      <SettingsContent onCheckUpdate={handleCheckUpdate} />

      <Dialog open={openUpdateModal} onOpenChange={setOpenUpdateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("updateModal")}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-28 flex-col justify-center gap-3">
            <DialogDescription>
              {updateChecking
                ? t("checkingForUpdates")
                : updateAvailable
                  ? t("updateAvailable")
                  : t("updateNotAvailable")}
            </DialogDescription>
            {!updateChecking && updateAvailable ? (
              <div className="flex items-center gap-3">
                <Progress
                  value={displayedDownloadProgress}
                  aria-label={t("updateAvailable")}
                  className="flex-1"
                />
                <span className="w-12 text-right text-sm tabular-nums">
                  {Math.round(displayedDownloadProgress)}%
                </span>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleHiddenUpdateModal}
            >
              {t("close")}
            </Button>
            {updateAvailable ? (
              updateDownloaded ? (
                <Button type="button" onClick={handleInstallUpdate}>
                  {t("install")}
                </Button>
              ) : (
                <Button type="button" onClick={handleUpdate}>
                  {t("update")}
                </Button>
              )
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};

export default SettingPage;

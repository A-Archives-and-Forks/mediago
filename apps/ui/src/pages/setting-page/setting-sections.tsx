import { App as AntdApp } from "antd";
import {
  Chrome,
  Copy,
  Download,
  Eraser,
  FolderOpen,
  Upload,
} from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useController, useFormContext } from "react-hook-form";
import {
  exportFavorites as exportFavoritesApi,
  importFavorites,
} from "@/api/favorite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEnvPath } from "@/hooks/use-config";
import { usePlatform } from "@/hooks/use-platform";
import { useAppStore } from "@/store/app";
import { useSessionStore } from "@/store/session";
import { isWeb } from "@/utils";
import {
  SettingBooleanRadioField,
  SettingCard,
  SettingNumberField,
  SettingRow,
  SettingSelectField,
  SettingSwitchField,
  SettingTextField,
  usePersistSetting,
} from "./setting-fields";
import { AppLanguage, type AppStore, AppTheme } from "@mediago/shared-common";

const version = import.meta.env.APP_VERSION;
const EXTENSION_GUIDE_URL = "https://downloader.caorushizi.cn/extension.html";

const actionButtonClass = "shrink-0";

export const BasicSettingsCard = memo(function BasicSettingsCard() {
  const { t } = useTranslation();
  const { dialog } = usePlatform();
  const persistSetting = usePersistSetting();
  const { control, setValue } = useFormContext<AppStore>();
  const { field: localField } = useController({ name: "local", control });

  const selectDirectory = async () => {
    const paths = await dialog.open({ type: "directory" });
    const local = paths?.[0];
    if (!local) return;
    setValue("local", local, { shouldDirty: true });
    await persistSetting("local", local);
  };

  return (
    <SettingCard title={t("basicSetting")}>
      <SettingRow label={t("localDir")} htmlFor="setting-local">
        <div className="flex min-w-0 gap-2">
          <Input
            id="setting-local"
            value={String(localField.value ?? "")}
            disabled
            placeholder={t("pleaseSelectDownloadDir")}
          />
          {!isWeb ? (
            <Button
              type="button"
              variant="outline"
              onClick={selectDirectory}
              className={actionButtonClass}
            >
              <FolderOpen className="size-4" />
              {t("selectFolder")}
            </Button>
          ) : null}
        </div>
      </SettingRow>

      {!isWeb ? (
        <SettingSelectField
          name="theme"
          label={t("downloaderTheme")}
          placeholder={t("pleaseSelectTheme")}
          options={[
            { label: t("followSystem"), value: AppTheme.System },
            { label: t("dark"), value: AppTheme.Dark },
            { label: t("light"), value: AppTheme.Light },
          ]}
        />
      ) : null}

      <SettingSelectField
        name="language"
        label={t("displayLanguage")}
        placeholder={t("pleaseSelectLanguage")}
        options={[
          { label: t("followSystem"), value: AppLanguage.System },
          { label: t("chinese"), value: AppLanguage.ZH },
          { label: t("english"), value: AppLanguage.EN },
          { label: t("italian"), value: AppLanguage.IT },
        ]}
      />

      {!isWeb ? (
        <>
          <SettingSwitchField name="promptTone" label={t("downloadPrompt")} />
        </>
      ) : null}
      <SettingSwitchField name="showTerminal" label={t("showTerminal")} />
      {!isWeb ? (
        <>
          <SettingSwitchField
            name="autoUpgrade"
            label={t("autoUpgrade")}
            tooltip={t("autoUpgradeTooltip")}
          />
          <SettingSwitchField name="allowBeta" label={t("allowBetaVersion")} />
          <SettingBooleanRadioField
            name="closeMainWindow"
            label={t("closeMainWindow")}
            options={[
              { label: t("close"), value: true },
              { label: t("minimizeToTray"), value: false },
            ]}
          />
          <SettingSwitchField
            name="enableMobilePlayer"
            label={t("enableMobilePlayer")}
          />
        </>
      ) : null}
    </SettingCard>
  );
});

export const BrowserSettingsCard = memo(function BrowserSettingsCard() {
  const { t } = useTranslation();
  const { browser, contextMenu, dialog } = usePlatform();
  const { message } = AntdApp.useApp();

  const showTextMenu = () =>
    contextMenu.show([
      { key: "copy", label: t("copy") },
      { key: "paste", label: t("paste") },
    ]);

  const clearCache = async () => {
    try {
      await browser.clearCache();
      message.success(t("clearCacheSuccess"));
    } catch {
      message.error(t("clearCacheFailed"));
    }
  };

  const exportFavorites = async () => {
    try {
      const content = await exportFavoritesApi();
      await dialog.save({
        content:
          typeof content === "string"
            ? content
            : JSON.stringify(content, null, 2),
        defaultPath: "favorites.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      message.success(t("exportFavoriteSuccess"));
    } catch {
      message.error(t("exportFavoriteFailed"));
    }
  };

  const importFavoriteFile = async () => {
    try {
      const contents = await dialog.open({
        type: "file",
        filters: [{ name: "JSON", extensions: ["json"] }],
        readContent: true,
      });
      if (!contents?.length) return;
      const favorites = JSON.parse(contents[0]);
      if (Array.isArray(favorites)) await importFavorites(favorites);
      message.success(t("importFavoriteSuccess"));
    } catch {
      message.error(t("importFavoriteFailed"));
    }
  };

  return (
    <SettingCard title={t("browserSetting")}>
      <SettingSwitchField name="audioMuted" label={t("audioMuted")} />
      <SettingSwitchField name="openInNewWindow" label={t("openInNewWindow")} />
      <SettingTextField
        name="proxy"
        label={t("proxySetting")}
        placeholder={t("pleaseEnterProxy")}
        onContextMenu={showTextMenu}
      />
      <SettingSwitchField
        name="useProxy"
        label={t("proxySwitch")}
        validate={(checked, getValues) => {
          const proxy = getValues("proxy");
          if (checked && proxy === "") return t("pleaseEnterProxyFirst");
          return undefined;
        }}
      />
      <SettingSwitchField name="blockAds" label={t("blockAds")} />
      <SettingSwitchField name="isMobile" label={t("enterMobileMode")} />
      <SettingSwitchField
        name="useExtension"
        label={t("useImmersiveSniffing")}
        tooltip={t("immersiveSniffingDescription")}
      />
      <SettingSwitchField
        name="privacy"
        label={t("privacy")}
        tooltip={t("privacyTooltip")}
      />
      <SettingRow label={t("moreAction")}>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={clearCache}>
            <Eraser className="size-4" />
            {t("clearCache")}
          </Button>
          <Button type="button" variant="outline" onClick={exportFavorites}>
            <Download className="size-4" />
            {t("exportFavorite")}
          </Button>
          <Button type="button" variant="outline" onClick={importFavoriteFile}>
            <Upload className="size-4" />
            {t("importFavorite")}
          </Button>
        </div>
      </SettingRow>
    </SettingCard>
  );
});

export const DownloadSettingsCard = memo(function DownloadSettingsCard() {
  const { t } = useTranslation();
  const { contextMenu } = usePlatform();

  return (
    <SettingCard title={t("downloadSetting")}>
      {isWeb ? (
        <SettingTextField
          name="proxy"
          label={t("proxySetting")}
          placeholder={t("pleaseEnterProxy")}
          onContextMenu={() =>
            contextMenu.show([
              { key: "copy", label: t("copy") },
              { key: "paste", label: t("paste") },
            ])
          }
        />
      ) : null}
      <SettingSwitchField
        name="downloadProxySwitch"
        label={t("downloadProxySwitch")}
        validate={(checked, getValues) => {
          const proxy = getValues("proxy");
          if (checked && proxy === "") return t("pleaseEnterProxyFirst");
          return undefined;
        }}
      />
      <SettingSwitchField name="deleteSegments" label={t("deleteSegments")} />
      <SettingNumberField
        name="maxRunner"
        label={t("maxRunner")}
        tooltip={t("maxRunnerDescription")}
        min={1}
        max={50}
      />
    </SettingCard>
  );
});

export const DockerSettingsCard = memo(function DockerSettingsCard() {
  const { t } = useTranslation();
  const { contextMenu } = usePlatform();
  const showTextMenu = () =>
    contextMenu.show([
      { key: "copy", label: t("copy") },
      { key: "paste", label: t("paste") },
    ]);

  return (
    <SettingCard title={t("dockerSetting")}>
      <SettingTextField
        name="apiKey"
        label={t("apiKey")}
        placeholder={t("pleaseEnterApiKey")}
        onContextMenu={showTextMenu}
      />
      <SettingTextField
        name="dockerUrl"
        label={t("dockerUrl")}
        placeholder={t("pleaseEnterDockerUrl")}
        onContextMenu={showTextMenu}
      />
      <SettingSwitchField name="enableDocker" label={t("enableDocker")} />
    </SettingCard>
  );
});

export const SkillsSettingsCard = memo(function SkillsSettingsCard() {
  const { t } = useTranslation();
  const { envPath } = useEnvPath();
  const apiKey = useAppStore((state) => state.apiKey);
  const { message } = AntdApp.useApp();
  const coreUrl = envPath?.playerUrl
    ? envPath.playerUrl.replace(/\/player\/$/, "")
    : "";
  const installCommand = t("skillsInstallCmd");
  const setupCommand = isWeb
    ? apiKey
      ? `Set mediago url to ${coreUrl || "http://localhost:8899"}, api key to ${apiKey}`
      : `Set mediago url to ${coreUrl || "http://localhost:8899"}`
    : coreUrl
      ? `Set mediago url to ${coreUrl}`
      : "Set mediago url to http://localhost:39719";

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      message.success(t("skillsCopied"));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <SettingCard title={t("skillsSetting")}>
      <SettingRow
        label={t("skillsInstall")}
        tooltip={t("skillsInstallTooltip")}
        htmlFor="skills-install-command"
      >
        <div className="flex min-w-0">
          <Input
            id="skills-install-command"
            value={installCommand}
            readOnly
            className="rounded-r-none font-mono"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => copy(installCommand)}
            className="rounded-l-none border-l-0"
          >
            <Copy className="size-4" />
            {t("skillsCopy")}
          </Button>
        </div>
      </SettingRow>
      <SettingRow
        label={t("skillsInit")}
        tooltip={t("skillsInitTooltip")}
        htmlFor="skills-setup-command"
      >
        <div className="flex min-w-0">
          <Input
            id="skills-setup-command"
            value={setupCommand}
            readOnly
            className="rounded-r-none font-mono"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => copy(setupCommand)}
            className="rounded-l-none border-l-0"
          >
            <Copy className="size-4" />
            {t("skillsCopy")}
          </Button>
        </div>
      </SettingRow>
    </SettingCard>
  );
});

export const BrowserExtensionCard = memo(function BrowserExtensionCard() {
  const { t } = useTranslation();
  const { app, shell } = usePlatform();

  return (
    <SettingCard title={t("browserExtension")}>
      <SettingRow label={t("moreAction")}>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              const dir = await app.getExtensionDir();
              if (dir) shell.open(dir);
            }}
          >
            <FolderOpen className="size-4" />
            {t("extensionDir")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => shell.open(EXTENSION_GUIDE_URL)}
          >
            <Chrome className="size-4" />
            {t("extensionGuide")}
          </Button>
        </div>
      </SettingRow>
    </SettingCard>
  );
});

export const MoreSettingsCard = memo(function MoreSettingsCard({
  onCheckUpdate,
}: {
  onCheckUpdate: () => void;
}) {
  const { t } = useTranslation();
  const { shell } = usePlatform();
  const { envPath } = useEnvPath();
  const local = useAppStore((state) => state.local);
  const apiKey = useAppStore((state) => state.apiKey);
  const updateAvailable = useSessionStore((state) => state.updateAvailable);

  return (
    <SettingCard title={t("moreSettings")}>
      {isWeb ? (
        <SettingRow label={t("apiKey")} htmlFor="setting-web-api-key">
          <Input id="setting-web-api-key" value={apiKey} disabled />
        </SettingRow>
      ) : (
        <SettingRow label={t("moreAction")}>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                envPath?.configDir && shell.open(envPath.configDir)
              }
            >
              <FolderOpen className="size-4" />
              {t("configDir")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => envPath?.binDir && shell.open(envPath.binDir)}
            >
              <FolderOpen className="size-4" />
              {t("binPath")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => local && shell.open(local)}
            >
              <FolderOpen className="size-4" />
              {t("localDir")}
            </Button>
          </div>
        </SettingRow>
      )}
      <SettingRow label={t("currentVersion")}>
        <div className="flex items-center gap-4">
          <span>{version}</span>
          {!isWeb ? (
            <span className="relative">
              <Button type="button" variant="ghost" onClick={onCheckUpdate}>
                {t("checkUpdate")}
              </Button>
              {updateAvailable ? (
                <span className="absolute right-0 top-0 size-2 rounded-full bg-red-500" />
              ) : null}
            </span>
          ) : null}
        </div>
      </SettingRow>
    </SettingCard>
  );
});

import { ExternalLink, X } from "lucide-react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { usePlatform } from "@/hooks/use-platform";
import {
  isSettingsPromoEligible,
  loadSettingsPromoManifest,
  selectSettingsPromoContent,
  SETTINGS_PROMO_URL,
} from "@/services/settings-promo";
import { isWeb } from "@/utils";
import { SettingCard } from "./setting-fields";

const DISMISSAL_KEY = "mediago.settings-promo.dismissal.v1";
const DISMISSAL_SCHEMA_VERSION = 1;

function readDismissedCampaignId(): string {
  try {
    const value = JSON.parse(localStorage.getItem(DISMISSAL_KEY) || "null") as {
      schemaVersion?: unknown;
      campaignId?: unknown;
    } | null;
    return value?.schemaVersion === DISMISSAL_SCHEMA_VERSION &&
      typeof value.campaignId === "string"
      ? value.campaignId
      : "";
  } catch {
    return "";
  }
}

function saveDismissedCampaignId(campaignId: string): void {
  try {
    localStorage.setItem(
      DISMISSAL_KEY,
      JSON.stringify({
        schemaVersion: DISMISSAL_SCHEMA_VERSION,
        campaignId,
        dismissedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Dismissal remains effective for this session when storage is unavailable.
  }
}

export const SettingsPromoCard = memo(function SettingsPromoCard() {
  const { i18n, t } = useTranslation();
  const { shell } = usePlatform();
  const [dismissedCampaignId, setDismissedCampaignId] = useState(
    readDismissedCampaignId,
  );
  const { data: manifest } = useSWR(
    `settings-promo:${SETTINGS_PROMO_URL}`,
    () => loadSettingsPromoManifest(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    },
  );

  if (!manifest) return null;
  if (dismissedCampaignId === manifest.campaignId) return null;
  if (
    !isSettingsPromoEligible(manifest, {
      appVersion: import.meta.env.APP_VERSION || "0.0.0",
      now: Date.now(),
      platform: isWeb ? "web" : "electron",
    })
  ) {
    return null;
  }

  const content = selectSettingsPromoContent(
    manifest,
    i18n.resolvedLanguage ?? i18n.language,
  );
  if (!content) return null;

  const dismissAction = manifest.dismissible ? (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="size-8"
      aria-label={t("dismissPromotion")}
      onClick={() => {
        saveDismissedCampaignId(manifest.campaignId);
        setDismissedCampaignId(manifest.campaignId);
      }}
    >
      <X className="size-4" />
    </Button>
  ) : undefined;

  return (
    <SettingCard
      title={t("settingsPromotion")}
      headerAction={dismissAction}
      className="border-primary/20"
    >
      <div className="py-4">
        {manifest.imageUrl ? (
          <img
            src={manifest.imageUrl}
            alt={content.imageAlt ?? ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="mb-4 aspect-[16/7] w-full rounded-md border object-cover"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        ) : null}
        <div className="rounded-md border border-primary/15 bg-primary/[0.04] p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {content.badge ?? t("settingsPromotion")}
            </span>
          </div>
          <h3 className="mt-3 text-base font-semibold leading-6">
            {content.title}
          </h3>
          <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
            {content.description}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={() => void shell.open(manifest.actionUrl)}
          >
            {content.button}
            <ExternalLink className="size-4" />
          </Button>
        </div>
      </div>
    </SettingCard>
  );
});

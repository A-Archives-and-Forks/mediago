import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DownloadBg1, DownloadBg2 } from "@/assets/svg";

interface Props {
  onClick?: () => void;
}

export function HomeDownloadButton({ onClick }: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="relative flex cursor-pointer flex-row items-center gap-2 overflow-hidden rounded-md bg-linear-to-r from-[#24C1FF] to-[#823CFE] px-2 py-1 text-sm text-white"
      onClick={onClick}
    >
      <img
        className="absolute -left-0 bottom-0 top-0 h-full"
        src={DownloadBg2}
      />
      <img
        className="absolute -left-2 bottom-0 top-0 h-full"
        src={DownloadBg1}
      />
      <Download className="relative size-4 shrink-0 stroke-[1.75]" />
      {t("newDownload")}
    </div>
  );
}

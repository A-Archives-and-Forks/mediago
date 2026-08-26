import { type ClassValue, clsx } from "clsx";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/it";
import "dayjs/locale/zh-cn";
import { twMerge } from "tailwind-merge";
import { isUrl } from "./url";
import { DownloadType } from "@mediago/shared-common";

export { isWeb } from "../environment";

dayjs.extend(relativeTime);

export { http, setupHttp } from "./http";
export { tdApp } from "./tdapp";

export const requestImage = (url: string, timeout = 1000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const handleError = () => {
      img.src = "";
      reject();
    };
    const timer = setTimeout(handleError, timeout);
    const handleOnLoad = () => {
      clearTimeout(timer);
      resolve();
    };
    img.addEventListener("error", handleError);
    img.addEventListener("load", handleOnLoad);
    img.src = url;
  });
};

export const getFavIcon = (url: string): string => {
  // Return the canonical /favicon.ico URL without probing via <img> first.
  // The probe used a 1s timeout and dropped any URL that wasn't instantly
  // loadable (CORS, redirects, slow TLS, sites serving favicons from other
  // paths), which left most favorites with an empty icon. The consumer
  // (<Avatar src> in fav-item.tsx) already falls back to a link icon when
  // the image fails to load, so a best-effort URL is safe here.
  try {
    const urlObject = new URL(url);
    return urlObject.origin ? `${urlObject.origin}/favicon.ico` : "";
  } catch {
    return "";
  }
};

export const generateUrl = (url: string) => {
  let result = url;
  if (!/^https?:\/\//.test(url)) {
    result = `http://${url}`;
  }
  if (!isUrl(result)) {
    result = `https://www.baidu.com/s?word=${url}`;
  }
  return result;
};

export function moment() {
  return dayjs().format("YYYY-MM-DDTHH:mm:ssZ");
}

export function fromatDateTime(
  d: string | number | Date | undefined,
  tmpStr: string = "YYYY/MM/DD HH:mm:ss",
) {
  if (!d) return "";

  return dayjs(d).format(tmpStr);
}

export function formatRelativeTime(
  d: string | number | Date | undefined,
  language: string,
) {
  if (!d) return "";

  const value = dayjs(d);
  if (!value.isValid()) return "";

  const locale = language.startsWith("zh")
    ? "zh-cn"
    : language.startsWith("it")
      ? "it"
      : "en";
  return value.locale(locale).fromNow();
}

export function getFileName(url: string) {
  const urlObject = new URL(url);
  const name = urlObject.pathname.split("/").pop() || "";
  return decodeURIComponent(name);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isDownloadType(value: string | null): value is DownloadType {
  if (!value) return false;

  return Object.values(DownloadType).includes(value as DownloadType);
}

export const urlDownloadType = (url: string): DownloadType => {
  if (url.includes("bilibili")) {
    return DownloadType.bilibili;
  }
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return DownloadType.youtube;
  }
  if (url.includes("m3u8")) {
    return DownloadType.m3u8;
  }
  return DownloadType.direct;
};

export const convertPlainObject = (obj: unknown) => {
  return JSON.parse(JSON.stringify(obj));
};

import type { DownloadTask } from "@mediago/common";
import axios from "axios";
import { useShallow } from "zustand/react/shallow";
import { appStoreSelector, useAppStore } from "@/store/app";

interface AddVideosToDockerOptions {
  dockerUrl: string;
  apiKey: string;
  items: Omit<DownloadTask, "id">[];
  immediate?: boolean;
}

export function postVideosToDocker({
  dockerUrl,
  apiKey,
  items,
  immediate = false,
}: AddVideosToDockerOptions) {
  const baseUrl = dockerUrl.trim().replace(/\/+$/, "");
  const config = apiKey
    ? {
        headers: {
          "X-API-Key": apiKey,
        },
      }
    : undefined;

  return axios.post(
    `${baseUrl}/api/downloads`,
    {
      tasks: items,
      startDownload: immediate,
    },
    config,
  );
}

export function useDockerApi() {
  const { dockerUrl, apiKey } = useAppStore(useShallow(appStoreSelector));

  const addVideosToDocker = ({
    items,
    immediate = false,
  }: {
    items: Omit<DownloadTask, "id">[];
    immediate?: boolean;
  }) => {
    return postVideosToDocker({
      dockerUrl,
      apiKey,
      items,
      immediate,
    });
  };

  return {
    addVideosToDocker,
  };
}

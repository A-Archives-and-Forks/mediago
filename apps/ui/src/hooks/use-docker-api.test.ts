import { DownloadType, type DownloadTask } from "@mediago/common";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { postVideosToDocker } from "./use-docker-api";

const tasks: Omit<DownloadTask, "id">[] = [
  {
    type: DownloadType.bilibili,
    name: "example video",
    url: "https://www.bilibili.com/video/BV1example",
    folder: "videos",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("postVideosToDocker", () => {
  it("uses the current download endpoint and sends the API key as a header", async () => {
    const response = { data: { success: true } };
    const post = vi.spyOn(axios, "post").mockResolvedValue(response);

    await expect(
      postVideosToDocker({
        dockerUrl: "https://docker.example.com/",
        apiKey: "docker-api-key",
        items: tasks,
        immediate: true,
      }),
    ).resolves.toBe(response);

    expect(post).toHaveBeenCalledWith(
      "https://docker.example.com/api/downloads",
      {
        tasks,
        startDownload: true,
      },
      {
        headers: {
          "X-API-Key": "docker-api-key",
        },
      },
    );
  });

  it("omits the authentication header when no API key is configured", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: {} });

    await postVideosToDocker({
      dockerUrl: "https://docker.example.com",
      apiKey: "",
      items: tasks,
    });

    expect(post).toHaveBeenCalledWith(
      "https://docker.example.com/api/downloads",
      {
        tasks,
        startDownload: false,
      },
      undefined,
    );
  });
});

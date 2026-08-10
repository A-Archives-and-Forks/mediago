import { http } from "@/utils";
import type { AppStore } from "@mediago/shared-common";

export interface GoEnvPath {
  configDir: string;
  binDir: string;
  platform: string;
  playerUrl: string;
}

export const getConfigKey = "/api/config";
export const getConfig = (options?: {
  suppressAuthRedirect?: boolean;
  timeoutMs?: number;
}): Promise<AppStore> =>
  http.get(getConfigKey, {
    suppressAuthRedirect: options?.suppressAuthRedirect,
    timeout: options?.timeoutMs,
  });

export const setConfigValue = <K extends keyof AppStore>(
  key: K,
  value: AppStore[K],
): Promise<void> => http.put(`/api/config/${String(key)}`, { value });

export const setConfigValues = (values: Partial<AppStore>): Promise<void> =>
  http.post(getConfigKey, values);

export const getEnvPathKey = "/api/env";
export const getEnvPath = (): Promise<GoEnvPath> => http.get(getEnvPathKey);

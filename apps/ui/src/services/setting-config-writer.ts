import { setConfigValues } from "@/api/config";
import type { AppStore } from "@mediago/shared-common";
import { createConfigWriteCoordinator } from "./config-write-coordinator";

export const settingConfigWriter =
  createConfigWriteCoordinator<AppStore>(setConfigValues);

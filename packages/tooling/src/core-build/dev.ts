import { chmodSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config, devConfig } from "./config";
import {
  createCurrentPlatformBuildArgs,
  type CurrentPlatformBuildMode,
} from "./build-args";
import { replaceEmbeddedAssets } from "./embedded-assets";
import { getExeExt, mkdir, runCommand } from "./utils";

const appVersion = (
  JSON.parse(
    readFileSync(join("..", "electron", "app", "package.json"), "utf8"),
  ) as { version: string }
).version;

/**
 * Start the development server
 */
export async function dev() {
  console.log("🚀 Starting development server...");
  await buildEmbeddedUIs();
  const args = [
    "run",
    "-tags",
    "dev",
    "-work",
    config.CMD_PATH,
    `-log-level=${devConfig.log_level}`,
    `-log-dir=${devConfig.log_dir}`,
    `-config-dir=${devConfig.config_dir}`,
    `-max-runner=${devConfig.max_runner.toString()}`,
    `-local-dir=${devConfig.local_dir}`,
    `-delete-segments=${devConfig.delete_segments.toString()}`,
    `-proxy=${devConfig.proxy}`,
    `-use-proxy=${devConfig.use_proxy.toString()}`,
    `-deps-dir=${devConfig.deps_dir}`,
  ];
  await runCommand("go", args, { description: "Start development server" });
}

async function buildEmbeddedUI(options: {
  label: string;
  projectDirectory: string;
  buildDirectory: string;
  targetDirectory: string;
  env?: Record<string, string>;
}) {
  console.log(`🎨 Building ${options.label}...`);
  await runCommand("pnpm", ["build"], {
    cwd: options.projectDirectory,
    env: { NODE_ENV: "production", ...options.env },
  });

  if (!existsSync(options.buildDirectory)) {
    throw new Error(
      `Expected ${options.label} build output at ${options.buildDirectory} but it was not found`,
    );
  }

  replaceEmbeddedAssets(options.buildDirectory, options.targetDirectory);
  console.log(`✅ ${options.label} copied to ${options.targetDirectory}`);
}

/** Build both browser surfaces and copy them into Core for go:embed. */
export async function buildEmbeddedUIs() {
  await Promise.all([
    buildEmbeddedUI({
      label: "main Web UI",
      projectDirectory: config.MAIN_UI_DIR,
      buildDirectory: config.MAIN_UI_BUILD_DIR,
      targetDirectory: config.MAIN_UI_ASSETS_DIR,
      env: { APP_TARGET: "server" },
    }),
    buildEmbeddedUI({
      label: "Player UI",
      projectDirectory: config.PLAYER_UI_DIR,
      buildDirectory: config.PLAYER_UI_BUILD_DIR,
      targetDirectory: config.PLAYER_ASSETS_DIR,
    }),
  ]);
}

async function buildCurrentPlatformBinary(
  name: string,
  commandPath: string,
  ldflags: string,
  mode: CurrentPlatformBuildMode,
) {
  const output = join(config.BIN_DIR, name + getExeExt());
  await runCommand(
    "go",
    createCurrentPlatformBuildArgs({
      commandPath,
      ldflags,
      mode,
      output,
    }),
    { description: `Compile ${name} for current platform` },
  );
  if (process.platform !== "win32") {
    chmodSync(output, 0o755);
  }
  return output;
}

/**
 * Compile the core service and CLI for the current platform.
 */
async function buildCurrentPlatform(mode: CurrentPlatformBuildMode) {
  console.log(`🔨 Compiling ${mode} build...`);

  await buildEmbeddedUIs();
  mkdir(config.BIN_DIR);

  const [serverOutput, cliOutput] = await Promise.all([
    buildCurrentPlatformBinary(
      config.APP_NAME,
      config.CMD_PATH,
      config.GO_LDFLAGS,
      mode,
    ),
    buildCurrentPlatformBinary(
      config.CLI_APP_NAME,
      config.CLI_CMD_PATH,
      `${config.GO_LDFLAGS} -X main.version=${appVersion}`,
      mode,
    ),
  ]);

  console.log(`✅ Core service compiled -> ${serverOutput}`);
  console.log(`✅ CLI compiled -> ${cliOutput}`);
}

export async function devBuild() {
  await buildCurrentPlatform("development");
}

export async function productionBuild() {
  await buildCurrentPlatform("production");
}

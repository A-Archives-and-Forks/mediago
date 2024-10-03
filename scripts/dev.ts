#!/usr/bin/env zx
import { echo, $ } from "zx";
$.verbose = true;

echo("开始构建 development ...");
echo("当前所在的目录是:", process.cwd());

await $`npm run types`;

await $`npm run build:plugin`;

await $`npm run build:mobile`;

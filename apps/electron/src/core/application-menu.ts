import { app, Menu, type MenuItemConstructorOptions } from "electron";

const separator = (): MenuItemConstructorOptions => ({ type: "separator" });

const topLevelLabel = (label: string, accessKey: string, isMac: boolean) =>
  isMac ? label : `${label}(&${accessKey})`;

export const createApplicationMenuTemplate = (
  applicationName = app.name,
  platform = process.platform,
): MenuItemConstructorOptions[] => {
  const isMac = platform === "darwin";
  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: applicationName,
      submenu: [
        { label: `关于 ${applicationName}`, role: "about" },
        separator(),
        { label: "服务", role: "services" },
        separator(),
        { label: `隐藏 ${applicationName}`, role: "hide" },
        { label: "隐藏其他应用", role: "hideOthers" },
        { label: "全部显示", role: "unhide" },
        separator(),
        { label: `退出 ${applicationName}`, role: "quit" },
      ],
    });
  }

  template.push(
    {
      label: topLevelLabel("文件", "F", isMac),
      submenu: isMac
        ? [{ label: "关闭窗口", role: "close" }]
        : [{ label: `退出 ${applicationName}`, role: "quit" }],
    },
    {
      label: topLevelLabel("编辑", "E", isMac),
      submenu: [
        { label: "撤销", role: "undo" },
        { label: "重做", role: "redo" },
        separator(),
        { label: "剪切", role: "cut" },
        { label: "复制", role: "copy" },
        { label: "粘贴", role: "paste" },
        ...(isMac
          ? [{ label: "粘贴并匹配样式", role: "pasteAndMatchStyle" as const }]
          : []),
        { label: "删除", role: "delete" },
        separator(),
        { label: "全选", role: "selectAll" },
        ...(isMac
          ? [
              separator(),
              {
                label: "语音",
                submenu: [
                  { label: "开始朗读", role: "startSpeaking" as const },
                  { label: "停止朗读", role: "stopSpeaking" as const },
                ],
              },
            ]
          : []),
      ],
    },
    {
      label: topLevelLabel("查看", "V", isMac),
      submenu: [
        { label: "重新加载", role: "reload" },
        { label: "强制重新加载", role: "forceReload" },
        { label: "切换开发者工具", role: "toggleDevTools" },
        separator(),
        { label: "重置缩放", role: "resetZoom" },
        { label: "放大", role: "zoomIn" },
        { label: "缩小", role: "zoomOut" },
        separator(),
        { label: "切换全屏", role: "togglefullscreen" },
      ],
    },
    {
      label: topLevelLabel("窗口", "W", isMac),
      submenu: isMac
        ? [
            { label: "最小化", role: "minimize" },
            { label: "缩放", role: "zoom" },
            separator(),
            { label: "前置全部窗口", role: "front" },
            separator(),
            { label: "窗口", role: "window" },
          ]
        : [
            { label: "最小化", role: "minimize" },
            { label: "缩放", role: "zoom" },
            { label: "关闭窗口", role: "close" },
          ],
    },
    {
      label: topLevelLabel("帮助", "H", isMac),
      role: "help",
      submenu: [{ label: `关于 ${applicationName}`, role: "about" }],
    },
  );

  return template;
};

export const installApplicationMenu = (): void => {
  const menu = Menu.buildFromTemplate(createApplicationMenuTemplate());
  Menu.setApplicationMenu(menu);
};

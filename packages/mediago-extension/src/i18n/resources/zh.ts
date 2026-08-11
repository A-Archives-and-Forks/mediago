const resource = {
  popup: {
    header: "MediaGo 资源检测",
    clear: "清空",
    importAll: "导入全部",
    importAllWithCount: "导入全部（{{count}}）",
    settings: "设置",
    imported: "已导入 {{count}} 个任务",
    importFailed: "导入失败",
  },
  status: {
    detecting: "检测中",
    schemaMode: "Schema 模式",
    notConfigured: "未配置",
    connectionFailed: "连接失败",
  },
  empty: {
    title: "当前页面暂未检测到可下载资源。",
    hint: "浏览网页过程中命中规则时会自动出现在这里。",
  },
  source: {
    unnamed: "(未命名)",
    import: "导入",
  },
  options: {
    pageTitle: "MediaGo 扩展设置",
    language: {
      title: "界面语言",
      description:
        '影响 popup 与设置页的显示语言。选择"跟随系统"时按浏览器 UI 语言自动挑选。',
      system: "跟随系统",
      zh: "中文",
      en: "English",
      it: "Italiano",
    },
    server: {
      title: "调用方式",
      description:
        "扩展不会自动降级。选定模式后，调用失败会直接报错——如需切换请返回此页面手动更改。",
      modeSchemaTitle: "Desktop · Schema 协议",
      modeSchemaDesc:
        "通过 mediago-community:// 协议唤起桌面版，并打开预填的下载确认表单。桌面版未运行时会自动拉起。",
      modeDesktopHttpTitle: "Desktop · HTTP 本地接口",
      modeDesktopHttpDesc:
        "通过 {{base}} 与运行中的桌面版通信。要求 Desktop 处于运行状态，但无需授权弹窗。",
      modeDockerHttpTitle: "Docker / 自建服务 · HTTP",
      modeDockerHttpDesc:
        "连接远端 Docker 部署或任何自建 MediaGo 服务端。需要填写服务器地址；启用鉴权时额外填 API Key。",
      serverUrlLabel: "服务器 URL",
      serverUrlPlaceholder: "http://your-host:8899",
      apiKeyLabel: "API Key",
      apiKeyOptional: "（可选）",
      apiKeyPlaceholder: "留空则不发送 X-API-Key",
      schemaNoteLead: "通过新的",
      schemaNoteMid:
        'Share Intent 协议调用桌面版。当前 tab 会跳到协议 URL，Chrome 首次弹出 "Open MediaGo-community?" 对话框时，请点',
      schemaAllow: "允许",
      schemaAlways: "总是允许",
      schemaAfter: "后续浏览器不再重复确认，MediaGo 仍会打开下载表单供你核对。",
      limitationLabel: "限制",
      limitationBody:
        "Schema 一次只能发送一条且不传递请求头；批量或带 Headers 的任务请切 HTTP 模式。",
      desktopHttpNoteLead: "固定连接",
      desktopHttpNoteTail:
        '——桌面版随应用启动自动监听，点击"测试连接"可确认当前是否在线。',
    },
    importBehaviour: {
      title: "导入行为",
      httpDescription: "HTTP 模式可以直接添加任务，并可选择是否立即开始下载。",
      schemaReviewOnly:
        "Schema 模式只负责唤起 MediaGo 并打开确认表单，不会自动创建或开始下载。",
      downloadNowLabel: "立即开始下载",
      downloadNowDesc:
        "开：任务进队列并立刻开跑。关：仅加入下载列表，等用户手动触发。仅对 HTTP 模式生效。",
    },
    rules: {
      title: "嗅探规则",
      descriptionLead: "当前规则由",
      descriptionTail: "集中维护，桌面版和浏览器扩展共享同一份。",
      m3u8Label: "HLS / m3u8 流",
      directLabel: "直连媒体文件",
      bilibiliLabel: "Bilibili 视频页",
      youtubeLabel: "YouTube",
    },
  },
  common: {
    save: "保存",
    saved: "已保存",
    saveFailed: "保存失败",
    testConnection: "测试连接",
  },
  errors: {
    serverUrlRequired: "请先填写服务器 URL",
    dockerServerRequired: "Docker 模式必须填写服务器 URL",
    schemaBatchNotSupported:
      "Schema 模式一次只能导入一条；批量导入请切换到 HTTP 模式（Options 页）",
    schemaHeadersNotSupported:
      "Schema 模式不传递请求头；请切换到 HTTP 模式导入该资源",
    schemaNoActiveTab: "当前窗口没有活动 tab，无法发起协议调用",
    schemaInvoked:
      "已唤起 mediago-community:// 协议，如 Desktop 窗口未出现请确认是否已安装",
    serverNotConfigured: "MediaGo 服务未配置",
    dockerNotConfigured: "Docker 模式未配置服务器地址，请先到设置页填写",
    unknown: "{{detail}}",
  },
};

export default resource;
export type ExtensionResources = typeof resource;

import type { ExtensionResources } from "./zh";

const resource: ExtensionResources = {
  popup: {
    header: "MediaGo Sniffer",
    clear: "Clear",
    importAll: "Import all",
    importAllWithCount: "Import all ({{count}})",
    settings: "Settings",
    imported: "Imported {{count}} task(s)",
    importFailed: "Import failed",
  },
  status: {
    detecting: "Detecting",
    schemaMode: "Schema mode",
    notConfigured: "Not configured",
    connectionFailed: "Connection failed",
  },
  empty: {
    title: "No downloadable resources detected on this page yet.",
    hint: "Matching sources show up here automatically as you browse.",
    reloadPage: "Reload current page",
    openSettings: "Open settings",
  },
  source: {
    unnamed: "(untitled)",
    import: "Import",
  },
  options: {
    pageTitle: "MediaGo Extension Settings",
    language: {
      title: "Interface Language",
      description:
        'Language used by the popup and options page. "Follow system" picks based on the browser UI language.',
      system: "Follow system",
      zh: "中文",
      en: "English",
      it: "Italiano",
    },
    server: {
      title: "Dispatch Mode",
      description:
        "The extension never silently falls back. Once a mode is chosen, any failure is reported as-is — switch modes manually on this page if you need to.",
      modeSchemaTitle: "Desktop · Schema protocol",
      modeSchemaDesc:
        "Open MediaGo Desktop through mediago-community:// and show a prefilled review dialog. Desktop launches automatically when needed.",
      modeDesktopHttpTitle: "Desktop · HTTP local",
      modeDesktopHttpDesc:
        "Talk to a running Desktop through {{base}}. Requires Desktop to be running, but no confirmation dialog.",
      modeDockerHttpTitle: "Docker / Self-hosted · HTTP",
      modeDockerHttpDesc:
        "Connect to a remote Docker deployment or any self-hosted MediaGo server. Requires a server URL; add an API Key when auth is enabled.",
      serverUrlLabel: "Server URL",
      serverUrlPlaceholder: "http://your-host:8899",
      apiKeyLabel: "API Key",
      apiKeyOptional: "(optional)",
      apiKeyPlaceholder: "Leave blank to skip the X-API-Key header",
      schemaNoteLead: "Uses the new",
      schemaNoteMid:
        'Share Intent protocol to invoke Desktop. The active tab navigates to the protocol URL. When Chrome first shows "Open MediaGo-community?", choose',
      schemaAllow: "Allow",
      schemaAlways: "Always allow",
      schemaAfter:
        "so Chrome stops asking; MediaGo still opens its review dialog.",
      limitationLabel: "Limitation",
      limitationBody:
        "Schema sends one task without headers. Use HTTP mode for batches or sources that require headers.",
      desktopHttpNoteLead: "Always connects to",
      desktopHttpNoteTail:
        ' — Desktop listens automatically on startup; use "Test connection" to verify it\'s online.',
    },
    importBehaviour: {
      title: "Import Behaviour",
      httpDescription:
        "HTTP modes can add tasks directly and optionally start downloading immediately.",
      schemaReviewOnly:
        "Schema only opens MediaGo with a review dialog. It never creates or starts a task automatically.",
      downloadNowLabel: "Start downloading immediately",
      downloadNowDesc:
        "On: the task is queued and started. Off: it is only added to the list. Applies to HTTP modes only.",
    },
    rules: {
      title: "Sniffing Rules",
      descriptionLead: "Rules are maintained centrally in",
      descriptionTail: "and shared between Desktop and the browser extension.",
      m3u8Label: "HLS / m3u8 streams",
      directLabel: "Direct media files",
      bilibiliLabel: "Bilibili video pages",
      youtubeLabel: "YouTube",
    },
  },
  common: {
    save: "Save",
    saved: "Saved",
    saveFailed: "Failed to save",
    testConnection: "Test connection",
  },
  errors: {
    serverUrlRequired: "Please fill in the server URL first",
    dockerServerRequired: "Docker mode requires a server URL",
    schemaBatchNotSupported:
      "Schema mode can only dispatch one task at a time; switch to HTTP mode (Options page) for batch imports.",
    schemaNoActiveTab:
      "No active tab in the current window — cannot invoke the protocol",
    schemaHeadersNotSupported:
      "Schema mode does not send request headers; use HTTP mode for this source.",
    schemaInvoked:
      "Invoked mediago-community:// — if the Desktop window didn't appear, make sure MediaGo Desktop is installed.",
    serverNotConfigured: "MediaGo server not configured",
    dockerNotConfigured:
      "Docker mode has no server URL yet — please configure one on the options page.",
    unknown: "{{detail}}",
  },
};

export default resource;

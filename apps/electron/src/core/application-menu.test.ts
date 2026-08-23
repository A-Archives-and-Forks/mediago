import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("electron", () => ({
  app: { name: "MediaGo" },
  Menu: {
    buildFromTemplate: vi.fn(),
    setApplicationMenu: vi.fn(),
  },
}));

const { i18n } = await import("./i18n");
const { createApplicationMenuTemplate } = await import("./application-menu");

type MenuEntry = {
  label?: string;
  submenu?: MenuEntry[];
};

function labelsOf(entries: MenuEntry[]): string[] {
  return entries.flatMap((entry) => [
    ...(entry.label ? [entry.label] : []),
    ...(Array.isArray(entry.submenu) ? labelsOf(entry.submenu) : []),
  ]);
}

describe("application menu localization", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  afterAll(async () => {
    await i18n.changeLanguage("zh");
  });

  test("renders the Linux menu in English when the resolved system language is English", () => {
    const labels = labelsOf(
      createApplicationMenuTemplate("MediaGo", "linux") as MenuEntry[],
    );

    expect(labels).toEqual([
      "File(&F)",
      "Quit MediaGo",
      "Edit(&E)",
      "Undo",
      "Redo",
      "Cut",
      "Copy",
      "Paste",
      "Delete",
      "Select All",
      "View(&V)",
      "Reload",
      "Force Reload",
      "Toggle Developer Tools",
      "Reset Zoom",
      "Zoom In",
      "Zoom Out",
      "Toggle Full Screen",
      "Window(&W)",
      "Minimize",
      "Zoom",
      "Close Window",
      "Help(&H)",
      "About MediaGo",
    ]);
  });

  test("renders macOS-only menu entries in the active language", async () => {
    await i18n.changeLanguage("it");

    const labels = labelsOf(
      createApplicationMenuTemplate("MediaGo", "darwin") as MenuEntry[],
    );

    expect(labels).toContain("Informazioni su MediaGo");
    expect(labels).toContain("Servizi");
    expect(labels).toContain("Nascondi MediaGo");
    expect(labels).toContain("Incolla e mantieni lo stile");
    expect(labels).toContain("Avvia riproduzione vocale");
    expect(labels).toContain("Porta tutte le finestre in primo piano");
  });
});

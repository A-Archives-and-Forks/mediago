import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const appStoreMocks = vi.hoisted(() => {
  const state = {
    enableMcp: true,
    mcpToken: "test-token",
    setAppStore: vi.fn(),
  };
  const useAppStore = Object.assign(
    (selector: (value: typeof state) => unknown) => selector(state),
    {
      getState: () => state,
      subscribe: vi.fn(() => () => undefined),
    },
  );
  return { state, useAppStore };
});

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("swr", () => ({
  default: () => ({
    data: { enabled: true, running: true, endpoint: "/mcp", error: "" },
    mutate: vi.fn(),
  }),
}));

vi.mock("@/services/adapter-bootstrap", () => ({
  getAdapterCoreUrl: () => "http://127.0.0.1:39719",
}));

vi.mock("@/hooks/use-platform", () => ({
  usePlatform: () => ({}),
}));

vi.mock("@/store/app", () => ({
  useAppStore: appStoreMocks.useAppStore,
}));

const { SettingsFormProvider } = await import("./setting-fields");
const { MCPSettingsCard } = await import("./setting-sections");

beforeEach(() => {
  appStoreMocks.state.enableMcp = true;
  appStoreMocks.state.mcpToken = "test-token";
});

test("renders MCP URL and token as separate labelled read-only inputs", () => {
  const html = renderToStaticMarkup(
    createElement(SettingsFormProvider, null, createElement(MCPSettingsCard)),
  );

  expect(html).toContain('for="mcp-url"');
  expect(html).toContain('id="mcp-url"');
  expect(html).toContain('value="http://127.0.0.1:39719/mcp"');
  expect(html).toContain('for="mcp-token"');
  expect(html).toContain('id="mcp-token"');
  expect(html).toContain('value="test-token"');
  expect(html.match(/readOnly=""/g) ?? []).toHaveLength(2);
  expect(html).not.toContain("<textarea");
});

test("keeps regenerate and copy actions on the same full-width row", () => {
  const html = renderToStaticMarkup(
    createElement(SettingsFormProvider, null, createElement(MCPSettingsCard)),
  );
  const actions = html.match(/<div[^>]*data-mcp-actions="true"[^>]*>/)?.[0];
  const labelIndex = html.indexOf(">mcpAgentConfig</div>");
  const rowStart = html.lastIndexOf('<div role="group"', labelIndex);
  const rowOpeningTag = html.slice(rowStart, html.indexOf(">", rowStart) + 1);

  expect(actions).toBeTypeOf("string");
  expect(actions).toContain("w-full");
  expect(actions).toContain("flex-nowrap");
  expect(rowOpeningTag).toContain(
    "@sm/settings:grid-cols-[minmax(140px,0.85fr)_minmax(180px,1.15fr)]",
  );
  expect(rowOpeningTag).not.toContain("@sm/settings:grid-cols-1");
});

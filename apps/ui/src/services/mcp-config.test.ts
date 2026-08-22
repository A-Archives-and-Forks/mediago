import { describe, expect, it } from "vitest";
import { buildMCPAgentConfig, buildMCPEndpoint } from "./mcp-config";

describe("buildMCPEndpoint", () => {
  it.each([
    ["http://127.0.0.1:9900", "http://127.0.0.1:9900/mcp"],
    ["http://192.168.1.10:39719/", "http://192.168.1.10:39719/mcp"],
    ["https://media.example/settings", "https://media.example/mcp"],
  ])("joins %s to the backend MCP route", (coreUrl, endpoint) => {
    expect(buildMCPEndpoint(coreUrl)).toBe(endpoint);
  });

  it("does not guess an endpoint before the backend URL is ready", () => {
    expect(buildMCPEndpoint("  ")).toBe("");
    expect(buildMCPAgentConfig("", "secret")).toBe("");
  });
});

it("builds the copied agent configuration", () => {
  expect(
    JSON.parse(buildMCPAgentConfig("http://server:8899", "secret")),
  ).toStrictEqual({
    mcpServers: {
      mediago: {
        type: "http",
        url: "http://server:8899/mcp",
        headers: { Authorization: "Bearer secret" },
      },
    },
  });
});

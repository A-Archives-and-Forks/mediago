export function buildMCPEndpoint(coreUrl: string): string {
  const baseUrl = coreUrl.trim();
  return baseUrl ? new URL("/mcp", baseUrl).toString() : "";
}

export function buildMCPAgentConfig(coreUrl: string, token: string): string {
  const endpoint = buildMCPEndpoint(coreUrl);
  if (!endpoint) return "";

  return JSON.stringify(
    {
      mcpServers: {
        mediago: {
          type: "http",
          url: endpoint,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
}

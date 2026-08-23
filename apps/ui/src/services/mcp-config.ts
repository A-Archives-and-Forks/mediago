export function buildMCPEndpoint(coreUrl: string): string {
  const baseUrl = coreUrl.trim();
  return baseUrl ? new URL("/mcp", baseUrl).toString() : "";
}

export function buildMCPAgentConfig(coreUrl: string, token: string): string {
  const endpoint = buildMCPEndpoint(coreUrl);
  if (!endpoint) return "";

  return `MCP URL: ${endpoint}\nMCP Token: ${token}`;
}

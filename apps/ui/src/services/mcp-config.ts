export function buildMCPEndpoint(coreUrl: string): string {
  const baseUrl = coreUrl.trim();
  return baseUrl ? new URL("/mcp", baseUrl).toString() : "";
}

interface MCPAgentConfigValues {
  endpoint: string;
  token: string;
}

type MCPAgentConfigFormatter = (values: MCPAgentConfigValues) => string;

const formatEnglishAgentConfig: MCPAgentConfigFormatter = ({
  endpoint,
  token,
}) =>
  [
    'Configure an MCP server named "mediago" in the current Agent client.',
    "Transport: Streamable HTTP",
    `URL: ${endpoint}`,
    "HTTP header:",
    `Authorization: Bearer ${token}`,
    "",
    "Use the client's secure secret or environment-variable mechanism for the token when available; otherwise configure the header directly.",
    "The Agent must be able to reach this URL. A localhost or 127.0.0.1 URL works only when the Agent runs on the same machine as MediaGo.",
    "",
    "Write this configuration to the client's active MCP settings and verify the connection by calling the health_check tool.",
    "If you cannot modify the settings directly, return the exact configuration snippet for the current client.",
  ].join("\n");

export function buildMCPAgentConfig(
  coreUrl: string,
  token: string,
  format: MCPAgentConfigFormatter = formatEnglishAgentConfig,
): string {
  const endpoint = buildMCPEndpoint(coreUrl);
  if (!endpoint || !token.trim()) return "";

  return format({ endpoint, token });
}

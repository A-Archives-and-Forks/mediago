# MCP and Backend Shared Port Design

## Summary

MediaGo will serve MCP from the Go Core HTTP server at `/mcp` instead of starting a second loopback HTTP server. The MCP endpoint will therefore be the current backend base URL plus `/mcp`, and it will inherit the backend's host and port binding exactly.

Examples:

- Backend `http://127.0.0.1:9900` → MCP `http://127.0.0.1:9900/mcp`
- Backend `http://192.168.1.10:39719` → MCP `http://192.168.1.10:39719/mcp`
- Docker `http://server.example:8899` → MCP `http://server.example:8899/mcp`

The existing `/mcp` path, enable switch, MCP tools, and independent `mcpToken` remain. The separate `mcpPort` setting and listener are removed without a compatibility proxy.

## Goals

- Run the backend API, UI routes, and MCP endpoint on one Go Core listener.
- Make the MCP address equal to the active backend base URL plus `/mcp`.
- Let MCP inherit every Go Core bind-address decision without extra IP filtering.
- Keep MCP authentication separate from the backend API key.
- Preserve live enable/disable and token rotation without restarting Go Core.
- Remove the MCP port field from persisted configuration, shared types, and the settings UI.

## Non-goals

- Changing the backend's host or port selection.
- Changing MCP tool names or behavior.
- Merging `mcpToken` with `apiKey`.
- Adding a legacy listener, redirect, or proxy on port `39720`.
- Adding MCP-specific allowlists, bind addresses, or remote-access flags.

## Current State

Go Core currently has two HTTP listeners:

1. The main Gin server listens on the host and port supplied through `HOST` and `PORT`.
2. `mcpserver.Manager` separately listens on `127.0.0.1:<mcpPort>`, using `39720` by default.

Changing `enableMcp`, `mcpPort`, or `mcpToken` currently causes the MCP manager to stop and recreate its listener. The settings page constructs the agent configuration from the stored MCP port.

## Proposed Architecture

### One listener

The main Gin engine owns the only network listener. The API server registers the MCP handler directly at `/mcp` using a Gin-to-`http.Handler` adapter such as `gin.WrapH`.

Registration uses `Any("/mcp", ...)`, not a POST-only Gin route. This ensures POST, GET, and DELETE all reach the Go SDK handler. In the current stateless configuration the SDK accepts POST and returns its protocol-defined `405 Method Not Allowed` response for unsupported GET or DELETE requests, instead of letting Gin return `404` or invoke the SPA fallback.

The main server continues to bind exactly as it does today. Because MCP is a route on that server, it is reachable on the same interfaces as every other backend route. No request-IP or forwarded-header checks are added.

### MCP manager responsibilities

`mcpserver.Manager` remains the owner of the MCP protocol server and tool registrations, but stops owning network resources. It contains:

- the Streamable HTTP MCP handler;
- the current enabled state;
- the current MCP bearer token;
- synchronized access to live settings;
- a status snapshot for the UI.

It no longer contains an `http.Server`, opens a `net.Listener`, validates a port, starts a serving goroutine, or closes a listener.

`Apply` accepts only `Enabled` and `Token`. Applying new settings updates memory atomically. Existing requests may finish with the settings snapshot they started with; new requests use the latest settings.

The manager also records whether the persistence-backed download service is available. This is a startup dependency, not a live setting. A nil download service must never reach MCP tool callbacks.

### Route and authentication

The main API server registers all methods required by Streamable HTTP on the exact `/mcp` path. The existing API authentication middleware explicitly treats `/mcp` as outside API-key authentication. The MCP handler then performs its own bearer-token check using the existing constant-time comparison.

This preserves two independent credentials:

- `apiKey` protects the regular backend API when backend auth is enabled;
- `mcpToken` protects `/mcp` whenever MCP is enabled.

The existing cross-origin protection, stateless MCP mode, JSON responses, request-size limit, and cancellation propagation remain unchanged.

## Request Flow

1. An MCP client sends a request to `<backend-base-url>/mcp`.
2. The request reaches the same listener and Gin engine as the backend API.
3. Gin dispatches the request to the wrapped MCP HTTP handler.
4. The MCP manager reads a consistent snapshot of `enableMcp` and `mcpToken`.
5. If MCP is disabled, the handler returns `404 Not Found`.
6. If the bearer token is missing or wrong, the handler returns `401 Unauthorized` with `WWW-Authenticate: Bearer`.
7. If the download service is unavailable, the handler returns `503 Service Unavailable`.
8. Otherwise, the existing Streamable HTTP handler processes the MCP request and invokes the existing tools.

Stopping Go Core stops both the backend and MCP because they share one server. No separate MCP shutdown step is required.

## Configuration and UI

### Removed configuration

Remove `mcpPort` from:

- the Go `AppStore` and its defaults;
- shared TypeScript and Core SDK types;
- the UI store defaults and persisted-setting field list;
- the MCP settings form;
- MCP port translations and validation;
- MCP listener status and tests.

The removal includes explicit cleanup in both persisted stores:

- After opening the Go configuration store, startup checks for the legacy `mcpPort` key and deletes it with `Conf.Delete`. A cleanup write failure fails runtime initialization instead of silently keeping a partially migrated configuration.
- The Zustand persisted store increments its schema version and supplies a migration that removes `mcpPort` from existing `appstore-storage` state before hydration.

MediaGo does not open the old port or migrate its value to another setting.

### Endpoint display

The adapter bootstrap module becomes the single source of truth for the runtime backend base URL. The same resolved value configures the HTTP client, initializes the event stream, and builds the MCP endpoint. It exposes a read-only accessor after initialization rather than making the MCP settings card independently rediscover the URL.

Resolution remains consistent with current behavior:

- Electron obtains `coreUrl` from its existing IPC environment response.
- Web development uses its configured development Core URL.
- A production browser uses `window.location.origin`.

The settings page appends `/mcp` to this canonical base URL with `new URL("/mcp", baseURL)`. It must not use a fixed desktop, development, or Docker port. If adapter initialization has not produced a URL yet, the copy action stays disabled instead of displaying a guessed endpoint.

The copied agent configuration remains:

```json
{
  "mcpServers": {
    "mediago": {
      "type": "http",
      "url": "<current-backend-base-url>/mcp",
      "headers": {
        "Authorization": "Bearer <mcpToken>"
      }
    }
  }
}
```

The UI keeps the enable switch, status, token regeneration, and copy action. It removes only the port control and updates explanatory text where it refers to a separate MCP service.

### Status

`GET /api/mcp/status` remains so the UI can display MCP readiness and its relative endpoint. It does not prove that a particular non-empty token value was applied because the response intentionally exposes no token value, version, or fingerprint; token persistence and reconciliation continue through the existing configuration flow. With no independent listener to fail, status is derived from the live manager state:

- `enabled` reflects the applied configuration;
- `running` is true only when MCP is enabled, has a non-empty token, and has an available download service;
- `endpoint` is `/mcp`, which clients resolve against the current backend base URL;
- `error` reports an empty token or unavailable download persistence.

## Error Behavior

| Condition                              | Result                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| MCP disabled                           | `404 Not Found`                                                                                                   |
| Missing or invalid MCP token           | `401 Unauthorized`                                                                                                |
| Empty configured MCP token             | Status reports the configuration error; every `/mcp` request, including `Authorization: Bearer `, returns `401`   |
| Enabled MCP without a download service | Status reports that persistence is unavailable; an authenticated `/mcp` request returns `503 Service Unavailable` |
| MCP tool input or execution failure    | Existing MCP protocol error response                                                                              |
| Go Core unavailable                    | Backend and MCP are both unreachable                                                                              |

The old listener-specific errors, including invalid MCP port and port already in use, disappear.

## Compatibility and Migration

This is an intentional hard cutover:

- Existing clients configured for `http://127.0.0.1:39720/mcp` stop working after upgrade.
- Users must copy the updated agent configuration from MediaGo settings.
- The `/mcp` path and token format remain unchanged.
- No process listens on `39720` unless that is also the selected Go Core backend port.

Release notes should call out the endpoint change explicitly.

## Testing Strategy

### Go tests

- Serve the Gin engine through one `httptest.Server` and complete an authenticated MCP `health_check` through `/mcp`.
- Verify disabled MCP returns `404`.
- Verify a missing or incorrect bearer token returns `401`.
- Rotate the token through `Apply`; verify the old token fails and the new token succeeds without restarting the test server.
- Register `/mcp` with all Gin methods and verify authenticated GET and DELETE receive the Go SDK's stateless `405` response rather than Gin or SPA `404`; disabled requests still receive `404`, and invalid-token requests still receive `401` before method dispatch.
- Verify the status route reports `/mcp` and follows enabled/token changes.
- Verify API-key authentication does not consume or reject the independent MCP bearer token.
- Verify a nil download service reports `running: false`, exposes a status error, and returns `503` only after successful MCP authentication without invoking a tool callback.
- Verify an empty token can never be authenticated.
- Verify Go startup removes a persisted legacy `mcpPort` key and surfaces cleanup-write failures.
- Remove listener lifecycle and port-validation tests that no longer represent the design.

### TypeScript and UI tests

- Verify the MCP settings card has no port field.
- Verify the copied configuration uses the current backend base URL plus `/mcp`.
- Verify endpoint joining avoids duplicate or missing slashes.
- Verify the HTTP client, event stream, and MCP configuration all consume the same adapter-owned backend URL.
- Verify enable-state polling and token regeneration still update the displayed configuration.
- Verify Zustand migration removes `mcpPort` from previously persisted state.
- Update configuration-contract tests and fixtures to ensure `mcpPort` is absent.

### Integration checks

- Electron: confirm the displayed MCP endpoint uses the actual Electron Go Core URL plus `/mcp`.
- Web development: confirm the endpoint uses the active development Core URL plus `/mcp`.
- Docker: confirm the existing published backend port also serves `/mcp`; no second Docker port mapping is required.

## Documentation

- Update user-facing MCP setup instructions to describe `<backend URL>/mcp`.
- Remove references to the MCP port setting and default port `39720`.
- Add a migration note telling existing MCP users to recopy their configuration.

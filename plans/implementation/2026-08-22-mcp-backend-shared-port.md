# MCP 与后端共用端口实施计划

## 目标

移除 MCP 独立监听端口，让 MCP 直接成为 Go Core 的 `/mcp` 路由。

最终地址规则只有一条：

```text
MCP 地址 = 当前后端地址 + /mcp
```

例如：

- 后端 `http://127.0.0.1:9900` → MCP `http://127.0.0.1:9900/mcp`
- 后端 `http://192.168.1.10:39719` → MCP `http://192.168.1.10:39719/mcp`
- Docker `http://server:8899` → MCP `http://server:8899/mcp`

## 已确认的行为

- Go Core 只保留一个 HTTP 监听器。
- MCP 完全继承 Go Core 的监听 IP 和端口，不增加额外 IP 限制。
- 保留 `/mcp` 路径、`enableMcp` 开关和独立的 `mcpToken`。
- 删除 `mcpPort` 配置和设置项。
- 不兼容旧地址 `http://127.0.0.1:39720/mcp`，不提供代理或重定向。
- MCP 关闭时 `/mcp` 返回 `404`。
- Token 缺失或错误时返回 `401`。
- MCP 已开启但下载数据库不可用时，认证成功的请求返回 `503`。
- 修改启用状态或 Token 不重启 Go Core。

## 文件范围

### Go Core

- `apps/core/internal/mcpserver/server.go`
- `apps/core/internal/mcpserver/server_test.go`
- `apps/core/internal/api/server/mcp.go`
- `apps/core/internal/api/server/mcp_test.go`（新增）
- `apps/core/internal/api/middleware/auth.go`
- `apps/core/internal/api/middleware/auth_test.go`
- `apps/core/cmd/server/main.go`
- `apps/core/internal/app/appstore.go`
- `apps/core/internal/app/runtime.go`
- `apps/core/internal/app/runtime_test.go`

### TypeScript 与 UI

- `packages/shared/common/src/types/index.ts`
- `packages/core-sdk/src/types.ts`
- `packages/core-sdk/src/client.ts`
- `apps/ui/src/store/app.ts`
- `apps/ui/src/store/app-store-migration.ts`（新增）
- `apps/ui/src/store/app-store-migration.test.ts`（新增）
- `apps/ui/src/services/adapter-bootstrap.ts`
- `apps/ui/src/services/mcp-config.ts`（新增）
- `apps/ui/src/services/mcp-config.test.ts`（新增）
- `apps/ui/src/pages/setting-page/setting-fields.tsx`
- `apps/ui/src/pages/setting-page/setting-sections.tsx`
- `packages/shared/common/src/i18n/resources/zh.ts`
- `packages/shared/common/src/i18n/resources/en.ts`
- `packages/shared/common/src/i18n/resources/it.ts`

### 发布说明

- 本次不修改 `docs/` 下会自动部署的发布文档。
- 等功能确认可发布后，再由用户单独决定是否补充迁移说明。

## 提交策略

- 实施阶段不按步骤或阶段提交。
- 所有代码、测试、文档和格式检查完成后，再统一提交一次。
- 最终提交信息建议使用：`feat: serve MCP on the backend port`。
- 如果用户没有要求提交，则保留工作区改动，不自动创建提交。

## 实施顺序

### 阶段 1：删除持久化的 `mcpPort`

- [x] 在 `apps/core/internal/app/runtime_test.go` 增加旧配置迁移测试：准备包含 `mcpPort` 的 `config.json`，执行迁移后确认该键被删除，其他配置保持不变。
- [x] 在 `apps/core/internal/app/runtime.go` 增加启动迁移函数。`conf.New` 完成后检查 `mcpPort`，存在时调用 `Conf.Delete("mcpPort")`。
- [x] 配置清理写入失败时返回明确错误，避免表面升级成功但旧配置仍残留。
- [x] 从 `apps/core/internal/app/appstore.go` 的结构体和默认值中删除 `MCPPort`。
- [x] 运行 Go 配置迁移测试。

验证命令：

```bash
cd apps/core
go test ./internal/app -run MCPPort -v
```

预期：迁移成功、迁移失败两个分支均通过。

### 阶段 2：把 MCP Manager 改成普通 HTTP Handler

- [x] 先重写 `apps/core/internal/mcpserver/server_test.go`，不再自行寻找和监听 TCP 端口。
- [x] 使用内存 HTTP RoundTripper 验证以下行为：
  - 未启用返回 `404`；
  - Token 缺失或错误返回 `401`；
  - 正确 Token 可以调用 `health_check`；
  - Token 热更新后旧 Token 失效、新 Token 生效；
  - 空 Token 永远不能通过认证；
  - 下载服务为空时状态不可用，认证成功后返回 `503`。

- [x] 从 `mcpserver.Settings` 删除 `Port`。
- [x] 从 `Manager` 删除 `http.Server`、`net.Listener`、启动 goroutine、端口校验和 `Close`。
- [x] Manager 只保留 MCP tools、Streamable HTTP Handler、下载服务、当前启用状态和 Token。
- [x] 新增 `Handler() http.Handler`，每次请求按以下顺序处理：
  1. 检查是否启用；
  2. 检查 MCP Bearer Token；
  3. 检查下载服务是否可用；
  4. 交给 Go MCP SDK 的 Streamable HTTP Handler。

- [x] `Apply` 只更新 `Enabled` 和 `Token`，使用锁保证请求读取到一致快照。
- [x] 状态中的 `endpoint` 固定返回相对路径 `/mcp`；`running` 仅在启用、Token 非空且下载服务可用时为 `true`。
- [x] 保留现有 stateless、JSON response、1 MiB 请求限制、取消传播和跨域保护配置。

验证命令：

```bash
cd apps/core
go test ./internal/mcpserver -v
go test -race ./internal/mcpserver
```

预期：不再启动独立监听器，认证、热更新和并发检查全部通过。

### 阶段 3：将 `/mcp` 挂到 Gin 主服务

- [x] 在 `apps/core/internal/api/server/mcp_test.go` 先增加路由测试。
- [x] 测试必须让 `POST`、`GET` 和 `DELETE` 都进入 MCP Handler，避免非 POST 请求落到 Gin `404` 或 SPA fallback。
- [x] 对启用且认证成功的 `GET`、`DELETE`，确认 Go MCP SDK 返回 `405` 和 `Allow: POST`。
- [x] 在 `apps/core/internal/api/server/mcp.go` 增加统一注册方法，例如：

```go
func (s *Server) RegisterMCPRoutes(handler http.Handler, status func() any) {
	s.engine.Any("/mcp", gin.WrapH(handler))
	// 保留 GET /api/mcp/status
}
```

- [x] 在 `apps/core/internal/api/middleware/auth.go` 将精确路径 `/mcp` 加入 API Key 白名单。
- [x] 在 `auth_test.go` 验证 `Authorization: Bearer <mcpToken>` 不会被 API Key 中间件提前拒绝；最终认证仍由 MCP Handler 完成。
- [x] 修改 `apps/core/cmd/server/main.go`：
  - 创建 Manager 后把 `manager.Handler()` 注册到主 Gin Server；
  - `Apply` 不再传端口；
  - 只监听 `enableMcp` 和 `mcpToken` 变化；
  - 删除 MCP 独立服务的关闭逻辑；
  - Go Core 停止时由主 HTTP Server 一并停止 MCP。

验证命令：

```bash
cd apps/core
go test ./internal/api/server ./internal/api/middleware ./internal/mcpserver -v
go test ./...
```

预期：MCP 客户端通过 Gin 的 `/mcp` 完成 `health_check`；全部 Go 测试通过。

### 阶段 4：清理 TypeScript 类型和浏览器持久化状态

- [x] 从共享 `AppStore`、Core SDK `AppStore` 和 UI 初始状态中删除 `mcpPort`。
- [x] 从 `EDITABLE_SETTING_KEYS` 删除 `mcpPort`。
- [x] 新增纯函数 `migrateAppStore`，从旧 Zustand 状态中删除 `mcpPort`，且不修改输入对象。
- [x] 给 Zustand `persist` 增加版本号和 `migrate` 回调。
- [x] 增加迁移测试，至少覆盖：旧状态删除端口、其他字段保留、无效输入安全返回。
- [x] 更新 Core SDK 中 MCP 状态注释，将“独立监听器状态”改为“共享 `/mcp` 路由状态”。

迁移函数建议接口：

```ts
export function migrateAppStore(persistedState: unknown): unknown;
```

验证命令：

```bash
pnpm exec vitest run apps/ui/src/store/app-store-migration.test.ts
pnpm type:check
```

预期：旧浏览器状态中的 `mcpPort` 被移除，类型检查不再出现 `mcpPort` 引用。

### 阶段 5：统一 MCP 地址来源

- [x] 在 `apps/ui/src/services/adapter-bootstrap.ts` 暴露只读的当前后端地址，例如 `getAdapterCoreUrl()`。
- [x] HTTP 客户端、事件流和 MCP 设置都使用同一个 `adapterCoreUrl`，不各自判断 Electron、开发环境或 Docker 地址。
- [x] 新增 `apps/ui/src/services/mcp-config.ts`，提供两个纯函数：

```ts
export function buildMCPEndpoint(coreUrl: string): string;
export function buildMCPAgentConfig(coreUrl: string, token: string): string;
```

- [x] 使用 `new URL("/mcp", coreUrl)` 拼接地址，避免重复或遗漏 `/`。
- [x] 地址尚未初始化时返回空结果或抛出可识别错误，由 UI 禁用复制按钮，不能猜测固定端口。
- [x] 测试 Electron/LAN、Web 开发、Docker/域名、带路径或尾部斜杠的 URL。

测试示例：

```ts
expect(buildMCPEndpoint("http://192.168.1.10:39719")).toBe(
  "http://192.168.1.10:39719/mcp",
);
expect(buildMCPEndpoint("https://media.example/")).toBe(
  "https://media.example/mcp",
);
```

验证命令：

```bash
pnpm exec vitest run apps/ui/src/services/mcp-config.test.ts
pnpm type:check
```

### 阶段 6：简化 MCP 设置界面

- [x] 从 `MCPSettingsCard` 删除 `mcpPort` selector、输入框和相关 effect 依赖。
- [x] 使用当前 `adapterCoreUrl` 和 `buildMCPAgentConfig` 生成复制内容。
- [x] 后端地址还未准备好时禁用复制按钮，并避免显示错误的示例端口。
- [x] 保留启用开关、运行状态、Token 重新生成和复制按钮。
- [x] Web/Docker 设置页也显示 MCP 卡片，复用当前浏览器访问的后端地址。
- [x] 从中、英、意大利语资源删除 `mcpPort` 文案。
- [x] 更新 MCP tooltip：不再描述“仅监听 localhost”，改为“与 MediaGo 后端使用相同地址”。
- [x] 将运行提示改为适用于 Electron、Web 和 Docker 的后端运行说明。
- [x] 运行定向测试、UI 类型检查和 lint。

验证命令：

```bash
pnpm exec vitest run apps/ui/src/services/mcp-config.test.ts apps/ui/src/store/app-store-migration.test.ts
pnpm -F @mediago/ui type:check
pnpm -F @mediago/ui lint
```

### 阶段 7：完成整体验证

- [x] 不修改会自动部署的 `docs/` 发布文档。
- [x] 在本实施计划中记录 Docker 不需要新增端口映射，现有 `8899` 同时服务 UI、API 和 MCP。
- [x] 搜索并确认生产代码、类型、文案中没有遗留 `mcpPort` 或 MCP 默认端口 `39720`。

搜索命令：

```bash
rg -n "mcpPort|39720|MCP port|MCP 端口|Porta MCP" apps packages
```

允许保留的结果仅限迁移测试数据；运行时代码必须为零。

完整验证：

```bash
pnpm test:go
pnpm test:ts
pnpm type:check
pnpm lint
pnpm format:check
```

手动验证：

1. 启动 Electron，开启 MCP，复制配置并调用 `health_check`。
2. 确认 MCP 地址和 Electron 当前 Go Core 地址的主机、端口一致。
3. 修改 Token，确认旧 Token 返回 `401`，新 Token 可用。
4. 关闭 MCP，确认 `/mcp` 返回 `404`。
5. 启动 Web/Docker，确认现有后端端口上的 `/mcp` 可访问，不需要暴露第二个端口。

## 验收标准

- Go Core 进程只有一个 MediaGo HTTP 监听器。
- `/mcp` 与 `/api` 使用相同的 IP 和端口。
- 设置页没有 MCP 端口输入框。
- Agent 配置 URL 始终等于当前后端地址加 `/mcp`。
- `mcpToken` 与 `apiKey` 继续独立工作。
- 开关和 Token 更新不重启后端。
- 旧 Go 配置和浏览器状态中的 `mcpPort` 被清理。
- Electron、Web 和 Docker 不需要新增端口配置。
- Go、TypeScript、类型、lint 和格式检查全部通过。

## 风险与注意事项

- 这是一次不兼容迁移；旧 MCP 客户端必须更新 URL。
- Electron 当前如果让 Go Core 监听局域网地址，MCP 也会随之对局域网开放；安全边界由独立 `mcpToken` 保证。
- `/mcp` 必须注册全部 HTTP 方法，再由 MCP SDK决定 `405`，不能只注册 `POST`。
- `/mcp` 必须明确跳过 API Key 中间件，否则同一个 Authorization Header 无法同时承载 API Key 和 MCP Token。
- 禁止重新引入固定的 `39719`、`9900`、`8899` 或 `39720` 作为 MCP 地址来源。

// Package mcpserver exposes MediaGo download management as a local MCP server.
package mcpserver

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"

	"caorushizi.cn/mediago/internal/service"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// DownloadConfig exposes the runtime settings used when starting downloads.
type DownloadConfig interface {
	GetLocalDir() string
	GetDeleteSegments() bool
}

// Settings controls the MCP route exposed by the main HTTP server.
type Settings struct {
	Enabled bool
	Token   string
}

// Status reports the MCP route's current readiness.
type Status struct {
	Enabled  bool   `json:"enabled"`
	Running  bool   `json:"running"`
	Endpoint string `json:"endpoint"`
	Error    string `json:"error,omitempty"`
}

// Manager owns the Streamable HTTP MCP handler and its live settings.
type Manager struct {
	mu       sync.RWMutex
	download *service.DownloadTaskService
	config   DownloadConfig
	settings Settings
	handler  http.Handler
	status   Status
}

// NewManager creates an MCP manager backed by MediaGo's existing task service.
func NewManager(download *service.DownloadTaskService, config DownloadConfig) *Manager {
	manager := &Manager{download: download, config: config}
	manager.handler = manager.httpHandler()
	manager.Apply(Settings{})
	return manager
}

// GenerateToken returns a cryptographically random bearer token.
func GenerateToken() (string, error) {
	data := make([]byte, 32)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return hex.EncodeToString(data), nil
}

// Apply updates the live MCP route settings without restarting the HTTP server.
func (m *Manager) Apply(settings Settings) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.settings = settings
	m.status = Status{
		Enabled:  settings.Enabled,
		Endpoint: "/mcp",
	}

	if !settings.Enabled {
		return
	}
	if strings.TrimSpace(settings.Token) == "" {
		m.status.Error = "MCP token is empty"
		return
	}
	if m.download == nil {
		m.status.Error = "download persistence is unavailable"
		return
	}

	m.status.Running = true
}

// Handler returns the MCP HTTP handler mounted by the main Gin server.
func (m *Manager) Handler() http.Handler {
	return http.HandlerFunc(m.serveHTTP)
}

// Status returns a snapshot of the listener state.
func (m *Manager) Status() Status {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

func (m *Manager) serveHTTP(w http.ResponseWriter, r *http.Request) {
	m.mu.RLock()
	settings := m.settings
	downloadAvailable := m.download != nil
	handler := m.handler
	m.mu.RUnlock()

	if !settings.Enabled {
		http.NotFound(w, r)
		return
	}
	if !hasValidBearerToken(r, settings.Token) {
		w.Header().Set("WWW-Authenticate", "Bearer")
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if !downloadAvailable {
		http.Error(w, "download persistence is unavailable", http.StatusServiceUnavailable)
		return
	}

	handler.ServeHTTP(w, r)
}

func (m *Manager) httpHandler() http.Handler {
	server := mcp.NewServer(
		&mcp.Implementation{Name: "mediago", Version: "3.5.0"},
		nil,
	)
	m.registerTools(server)

	streamable := mcp.NewStreamableHTTPHandler(
		func(*http.Request) *mcp.Server { return server },
		&mcp.StreamableHTTPOptions{
			Stateless:                    true,
			JSONResponse:                 true,
			MaxRequestBodyBytes:          1 << 20,
			PropagateRequestCancellation: true,
		},
	)
	protected := http.NewCrossOriginProtection().Handler(streamable)
	return protected
}

type emptyInput struct{}

type healthOutput struct {
	Status string `json:"status"`
}

type createDownloadInput struct {
	URL     string   `json:"url" jsonschema:"required,video or stream URL to download"`
	Type    string   `json:"type,omitempty" jsonschema:"download type: m3u8, bilibili, direct, mediago, or youtube"`
	Name    string   `json:"name,omitempty" jsonschema:"optional output file name"`
	Folder  string   `json:"folder,omitempty" jsonschema:"optional subdirectory under the MediaGo download directory"`
	Headers []string `json:"headers,omitempty" jsonschema:"optional HTTP headers such as User-Agent: value"`
}

type getDownloadInput struct {
	ID int64 `json:"id" jsonschema:"required,MediaGo download record ID"`
}

type listDownloadsInput struct {
	Current  int    `json:"current,omitempty" jsonschema:"page number, defaults to 1"`
	PageSize int    `json:"pageSize,omitempty" jsonschema:"page size, defaults to 50"`
	Filter   string `json:"filter,omitempty" jsonschema:"optional filter: done or list"`
}

type stopDownloadOutput struct {
	ID     int64  `json:"id"`
	Status string `json:"status"`
}

func (m *Manager) registerTools(server *mcp.Server) {
	readOnly := &mcp.ToolAnnotations{ReadOnlyHint: true}
	write := &mcp.ToolAnnotations{ReadOnlyHint: false}

	mcp.AddTool(server, &mcp.Tool{
		Name:        "health_check",
		Description: "Check whether the MediaGo MCP server is running.",
		Annotations: readOnly,
	}, func(context.Context, *mcp.CallToolRequest, emptyInput) (*mcp.CallToolResult, healthOutput, error) {
		return nil, healthOutput{Status: "ok"}, nil
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "create_download",
		Description: "Create, persist, and start a MediaGo download task.",
		Annotations: write,
	}, func(_ context.Context, _ *mcp.CallToolRequest, input createDownloadInput) (*mcp.CallToolResult, any, error) {
		if strings.TrimSpace(input.URL) == "" {
			return nil, nil, errors.New("url is required")
		}
		if input.Type == "" {
			input.Type = "m3u8"
		}
		var folder *string
		if input.Folder != "" {
			folder = &input.Folder
		}
		var headers *string
		if len(input.Headers) > 0 {
			data, err := json.Marshal(input.Headers)
			if err != nil {
				return nil, nil, err
			}
			value := string(data)
			headers = &value
		}
		record, err := m.download.AddDownloadTask(&service.AddDownloadTaskInput{
			Name:    input.Name,
			Type:    input.Type,
			URL:     input.URL,
			Folder:  folder,
			Headers: headers,
		})
		if err != nil {
			return nil, nil, err
		}
		if err := m.download.StartDownload(
			record.ID,
			m.config.GetLocalDir(),
			m.config.GetDeleteSegments(),
		); err != nil {
			return nil, nil, err
		}
		return nil, record, nil
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_download",
		Description: "Get one persisted MediaGo download, including its current status and output file when available.",
		Annotations: readOnly,
	}, func(_ context.Context, _ *mcp.CallToolRequest, input getDownloadInput) (*mcp.CallToolResult, any, error) {
		record, err := m.download.GetDownloadTask(input.ID, m.config.GetLocalDir())
		return nil, record, err
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "list_downloads",
		Description: "List persisted MediaGo downloads with pagination and optional status filtering.",
		Annotations: readOnly,
	}, func(_ context.Context, _ *mcp.CallToolRequest, input listDownloadsInput) (*mcp.CallToolResult, any, error) {
		result, err := m.download.GetDownloadTasks(
			input.Current,
			input.PageSize,
			input.Filter,
			m.config.GetLocalDir(),
		)
		return nil, result, err
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "stop_download",
		Description: "Stop an active MediaGo download task.",
		Annotations: write,
	}, func(_ context.Context, _ *mcp.CallToolRequest, input getDownloadInput) (*mcp.CallToolResult, stopDownloadOutput, error) {
		if err := m.download.StopDownload(input.ID); err != nil {
			return nil, stopDownloadOutput{}, err
		}
		return nil, stopDownloadOutput{ID: input.ID, Status: "stopped"}, nil
	})
}

func hasValidBearerToken(r *http.Request, token string) bool {
	if strings.TrimSpace(token) == "" {
		return false
	}
	authorization := r.Header.Get("Authorization")
	provided := strings.TrimPrefix(authorization, "Bearer ")
	return strings.HasPrefix(authorization, "Bearer ") &&
		len(provided) == len(token) &&
		subtle.ConstantTimeCompare([]byte(provided), []byte(token)) == 1
}

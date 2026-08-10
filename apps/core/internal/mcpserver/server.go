// Package mcpserver exposes MediaGo download management as a local MCP server.
package mcpserver

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"caorushizi.cn/mediago/internal/service"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// DownloadConfig exposes the runtime settings used when starting downloads.
type DownloadConfig interface {
	GetLocalDir() string
	GetDeleteSegments() bool
}

// Settings controls the dedicated loopback MCP listener.
type Settings struct {
	Enabled bool
	Port    int
	Token   string
}

// Status reports the actual MCP listener state.
type Status struct {
	Enabled  bool   `json:"enabled"`
	Running  bool   `json:"running"`
	Endpoint string `json:"endpoint"`
	Error    string `json:"error,omitempty"`
}

// Manager owns a restartable Streamable HTTP MCP listener.
type Manager struct {
	mu       sync.RWMutex
	download *service.DownloadTaskService
	config   DownloadConfig
	settings Settings
	server   *http.Server
	status   Status
}

// NewManager creates an MCP manager backed by MediaGo's existing task service.
func NewManager(download *service.DownloadTaskService, config DownloadConfig) *Manager {
	return &Manager{download: download, config: config}
}

// GenerateToken returns a cryptographically random bearer token.
func GenerateToken() (string, error) {
	data := make([]byte, 32)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return hex.EncodeToString(data), nil
}

// Apply starts, stops, or restarts the listener to match settings.
func (m *Manager) Apply(settings Settings) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if settings.Port == 0 {
		settings.Port = 39720
	}
	if settings.Port < 1 || settings.Port > 65535 {
		return fmt.Errorf("invalid MCP port %d", settings.Port)
	}

	if m.server != nil && m.settings == settings {
		return nil
	}
	if m.server != nil {
		_ = m.server.Close()
		m.server = nil
	}
	m.settings = settings
	m.status = Status{
		Enabled:  settings.Enabled,
		Endpoint: fmt.Sprintf("http://127.0.0.1:%d/mcp", settings.Port),
	}

	if !settings.Enabled {
		return nil
	}
	if m.download == nil {
		m.status.Error = "download persistence is unavailable"
		return errors.New(m.status.Error)
	}
	if strings.TrimSpace(settings.Token) == "" {
		m.status.Error = "MCP token is empty"
		return errors.New(m.status.Error)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(settings.Port))
	if err != nil {
		m.status.Error = err.Error()
		return fmt.Errorf("start MCP listener: %w", err)
	}

	server := &http.Server{
		Handler:           m.httpHandler(settings.Token),
		ReadHeaderTimeout: 10 * time.Second,
	}
	m.server = server
	m.status.Running = true
	m.status.Error = ""

	go func() {
		err := server.Serve(listener)
		m.mu.Lock()
		defer m.mu.Unlock()
		if m.server != server {
			return
		}
		m.server = nil
		m.status.Running = false
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			m.status.Error = err.Error()
		}
	}()
	return nil
}

// Close stops the MCP listener.
func (m *Manager) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.server == nil {
		return nil
	}
	err := m.server.Close()
	m.server = nil
	m.status.Running = false
	return err
}

// Status returns a snapshot of the listener state.
func (m *Manager) Status() Status {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

func (m *Manager) httpHandler(token string) http.Handler {
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

	mux := http.NewServeMux()
	mux.Handle("/mcp", bearerAuth(token, protected))
	return mux
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

func bearerAuth(token string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization := r.Header.Get("Authorization")
		provided := strings.TrimPrefix(authorization, "Bearer ")
		if !strings.HasPrefix(authorization, "Bearer ") || len(provided) != len(token) || subtle.ConstantTimeCompare([]byte(provided), []byte(token)) != 1 {
			w.Header().Set("WWW-Authenticate", "Bearer")
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

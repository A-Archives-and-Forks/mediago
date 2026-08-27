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
	"net/http"
	"strings"
	"sync"
	"time"

	"caorushizi.cn/mediago/internal/core"
	"caorushizi.cn/mediago/internal/db"
	"caorushizi.cn/mediago/internal/discovery"
	"caorushizi.cn/mediago/internal/service"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// DownloadConfig exposes the runtime settings used when starting downloads.
type DownloadConfig interface {
	GetLocalDir() string
	GetDeleteSegments() bool
}

// DiscoveryDownloader is the credential-safe handoff shared with the HTTP API.
type DiscoveryDownloader interface {
	CreateDownloads(context.Context, string, []string, string, bool) ([]*db.Video, error)
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
	mu                 sync.RWMutex
	download           *service.DownloadTaskService
	config             DownloadConfig
	discovery          *discovery.Service
	discoveryDownloads DiscoveryDownloader
	settings           Settings
	handler            http.Handler
	status             Status
}

// NewManager creates an MCP manager backed by MediaGo's existing task service.
func NewManager(download *service.DownloadTaskService, config DownloadConfig, discoveryService *discovery.Service, discoveryDownloads DiscoveryDownloader) *Manager {
	manager := &Manager{
		download:           download,
		config:             config,
		discovery:          discoveryService,
		discoveryDownloads: discoveryDownloads,
	}
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
	if m.discovery == nil {
		m.status.Error = "discovery service is unavailable"
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
	status := m.status
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
	if !status.Running {
		message := status.Error
		if message == "" {
			message = "MCP server is unavailable"
		}
		http.Error(w, message, http.StatusServiceUnavailable)
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
	Type    string   `json:"type,omitempty" jsonschema:"optional download type: m3u8, bilibili, direct, mediago, youtube, or xiaohongshu; inferred from the URL when omitted; youtube and xiaohongshu use yt-dlp"`
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

type discoverMediaInput struct {
	URL               string                  `json:"url" jsonschema:"required,page or media URL to discover"`
	Mode              discovery.DiscoveryMode `json:"mode,omitempty" jsonschema:"discovery mode: auto, browser, or inspect"`
	TimeoutMS         int                     `json:"timeoutMs,omitempty" jsonschema:"browser timeout in milliseconds from 3000 to 30000"`
	UseSessionCookies bool                    `json:"useSessionCookies,omitempty" jsonschema:"opt in to the signed-in desktop browser session for personalized content"`
	WaitSeconds       *int                    `json:"waitSeconds,omitempty" jsonschema:"seconds to wait for a terminal result from 0 to 25; defaults to 20"`
}

type discoveryIDInput struct {
	ID string `json:"id" jsonschema:"required,media discovery job ID"`
}

type downloadDiscoveredMediaInput struct {
	ID            string   `json:"id" jsonschema:"required,media discovery job ID"`
	SourceIDs     []string `json:"sourceIds" jsonschema:"required,one or more discovered source IDs"`
	Folder        string   `json:"folder,omitempty" jsonschema:"optional subdirectory under the MediaGo download directory"`
	StartDownload *bool    `json:"startDownload,omitempty" jsonschema:"start created downloads immediately; defaults to true"`
}

func (m *Manager) registerTools(server *mcp.Server) {
	closedWorld := false
	openWorld := true
	nonDestructive := false
	readOnly := &mcp.ToolAnnotations{ReadOnlyHint: true, OpenWorldHint: &closedWorld}
	write := &mcp.ToolAnnotations{ReadOnlyHint: false, DestructiveHint: &nonDestructive, OpenWorldHint: &closedWorld}

	mcp.AddTool(server, &mcp.Tool{
		Name:        "health_check",
		Description: "Check whether the MediaGo MCP server is running.",
		Annotations: readOnly,
	}, func(context.Context, *mcp.CallToolRequest, emptyInput) (*mcp.CallToolResult, healthOutput, error) {
		return nil, healthOutput{Status: "ok"}, nil
	})

	mcp.AddTool(server, &mcp.Tool{
		Name: "discover_media",
		Description: "Discover media sources from a page or inspect a direct HLS URL. " +
			"Browser discovery uses the Electron executor. Setting useSessionCookies=true opts in to the signed-in desktop browser session and may access personalized content. Returned jobs never include cookies or authorization headers.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true, OpenWorldHint: &openWorld},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, input discoverMediaInput) (*mcp.CallToolResult, discovery.DiscoveryJob, error) {
		job, err := m.discovery.Create(ctx, discovery.CreateDiscoveryInput{
			URL:               input.URL,
			Mode:              input.Mode,
			TimeoutMS:         input.TimeoutMS,
			UseSessionCookies: input.UseSessionCookies,
		})
		if err != nil {
			return nil, discovery.DiscoveryJob{}, discoveryToolError(err)
		}
		waitSeconds := 20
		if input.WaitSeconds != nil {
			waitSeconds = *input.WaitSeconds
		}
		if waitSeconds < 0 {
			return nil, discovery.DiscoveryJob{}, errors.New("waitSeconds must be between 0 and 25")
		}
		waitSeconds = min(waitSeconds, 25)
		if terminalDiscoveryStatus(job.Status) || waitSeconds == 0 {
			return nil, job, nil
		}
		job, err = waitForDiscovery(ctx, m.discovery, job.ID, time.Duration(waitSeconds)*time.Second)
		return nil, job, err
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_media_discovery",
		Description: "Get a redacted MediaGo media discovery job and its normalized sources.",
		Annotations: readOnly,
	}, func(_ context.Context, _ *mcp.CallToolRequest, input discoveryIDInput) (*mcp.CallToolResult, discovery.DiscoveryJob, error) {
		job, err := m.discovery.Get(strings.TrimSpace(input.ID))
		return nil, job, discoveryToolError(err)
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "cancel_media_discovery",
		Description: "Cancel a queued or running MediaGo media discovery job.",
		Annotations: &mcp.ToolAnnotations{ReadOnlyHint: false, DestructiveHint: &nonDestructive, OpenWorldHint: &closedWorld},
	}, func(ctx context.Context, _ *mcp.CallToolRequest, input discoveryIDInput) (*mcp.CallToolResult, discovery.DiscoveryJob, error) {
		job, err := m.discovery.Cancel(ctx, strings.TrimSpace(input.ID))
		return nil, job, discoveryToolError(err)
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "download_discovered_media",
		Description: "Create MediaGo download tasks from selected discovery source IDs. Private browser credentials remain in memory and are never returned.",
		Annotations: write,
	}, func(ctx context.Context, _ *mcp.CallToolRequest, input downloadDiscoveredMediaInput) (*mcp.CallToolResult, any, error) {
		if m.discoveryDownloads == nil {
			return nil, nil, errors.New("discovery_download_unavailable: discovery download service unavailable")
		}
		startDownload := input.StartDownload == nil || *input.StartDownload
		videos, err := m.discoveryDownloads.CreateDownloads(ctx, strings.TrimSpace(input.ID), input.SourceIDs, input.Folder, startDownload)
		return nil, videos, err
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "create_download",
		Description: "Create, persist, and start a MediaGo download task.",
		Annotations: write,
	}, func(_ context.Context, _ *mcp.CallToolRequest, input createDownloadInput) (*mcp.CallToolResult, any, error) {
		if strings.TrimSpace(input.URL) == "" {
			return nil, nil, errors.New("url is required")
		}
		if strings.TrimSpace(input.Type) == "" {
			input.Type = string(core.InferDownloadType(input.URL))
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

func waitForDiscovery(ctx context.Context, discoveryService *discovery.Service, id string, timeout time.Duration) (discovery.DiscoveryJob, error) {
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return discovery.DiscoveryJob{}, ctx.Err()
		case <-timer.C:
			job, err := discoveryService.Get(id)
			return job, discoveryToolError(err)
		case <-ticker.C:
			job, err := discoveryService.Get(id)
			if err != nil {
				return discovery.DiscoveryJob{}, discoveryToolError(err)
			}
			if terminalDiscoveryStatus(job.Status) {
				return job, nil
			}
		}
	}
}

func terminalDiscoveryStatus(status discovery.DiscoveryStatus) bool {
	return status == discovery.StatusCompleted || status == discovery.StatusFailed || status == discovery.StatusCancelled
}

func discoveryToolError(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", discovery.ErrorCode(err), err)
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

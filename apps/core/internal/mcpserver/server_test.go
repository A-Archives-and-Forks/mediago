package mcpserver

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"caorushizi.cn/mediago/internal/service"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type testDownloadConfig struct{}

func (testDownloadConfig) GetLocalDir() string     { return "" }
func (testDownloadConfig) GetDeleteSegments() bool { return true }

func TestGenerateToken(t *testing.T) {
	first, err := GenerateToken()
	if err != nil {
		t.Fatal(err)
	}
	second, err := GenerateToken()
	if err != nil {
		t.Fatal(err)
	}
	if len(first) != 64 || first == second {
		t.Fatalf("unexpected generated tokens: %q %q", first, second)
	}
}

func TestManagerHandlerStateAndAuthentication(t *testing.T) {
	manager := NewManager(&service.DownloadTaskService{}, testDownloadConfig{})

	response := serveManagerRequest(t, manager, http.MethodPost, "")
	if response.Code != http.StatusNotFound {
		t.Fatalf("disabled status = %d, want %d", response.Code, http.StatusNotFound)
	}

	manager.Apply(Settings{Enabled: true, Token: "first-secret"})
	response = serveManagerRequest(t, manager, http.MethodPost, "")
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("missing token status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
	if response.Header().Get("WWW-Authenticate") != "Bearer" {
		t.Fatalf("WWW-Authenticate = %q, want Bearer", response.Header().Get("WWW-Authenticate"))
	}

	manager.Apply(Settings{Enabled: true, Token: "second-secret"})
	response = serveManagerRequest(t, manager, http.MethodPost, "first-secret")
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("rotated old token status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
	response = serveManagerRequest(t, manager, http.MethodGet, "second-secret")
	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("authorized GET status = %d, want %d", response.Code, http.StatusMethodNotAllowed)
	}
	if response.Header().Get("Allow") != http.MethodPost {
		t.Fatalf("Allow = %q, want POST", response.Header().Get("Allow"))
	}

	status := manager.Status()
	if !status.Enabled || !status.Running || status.Endpoint != "/mcp" || status.Error != "" {
		t.Fatalf("unexpected ready status: %+v", status)
	}
}

func TestManagerRejectsEmptyToken(t *testing.T) {
	manager := NewManager(&service.DownloadTaskService{}, testDownloadConfig{})
	manager.Apply(Settings{Enabled: true, Token: ""})

	response := serveManagerRequest(t, manager, http.MethodPost, "")
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("empty token status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
	status := manager.Status()
	if status.Running || status.Error != "MCP token is empty" {
		t.Fatalf("unexpected empty-token status: %+v", status)
	}
}

func TestManagerReportsUnavailableDownloadPersistence(t *testing.T) {
	manager := NewManager(nil, testDownloadConfig{})
	manager.Apply(Settings{Enabled: true, Token: "secret"})

	unauthorized := serveManagerRequest(t, manager, http.MethodPost, "wrong")
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("invalid token status = %d, want %d", unauthorized.Code, http.StatusUnauthorized)
	}
	authorized := serveManagerRequest(t, manager, http.MethodPost, "secret")
	if authorized.Code != http.StatusServiceUnavailable {
		t.Fatalf("unavailable persistence status = %d, want %d", authorized.Code, http.StatusServiceUnavailable)
	}

	status := manager.Status()
	if status.Running || status.Error != "download persistence is unavailable" {
		t.Fatalf("unexpected unavailable status: %+v", status)
	}
}

func TestManagerServesAuthenticatedMCPRequest(t *testing.T) {
	manager := NewManager(&service.DownloadTaskService{}, testDownloadConfig{})
	manager.Apply(Settings{Enabled: true, Token: "secret"})

	authorizedClient := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		request.Header.Set("Authorization", "Bearer secret")
		response := httptest.NewRecorder()
		manager.Handler().ServeHTTP(response, request)
		return response.Result(), nil
	})}
	client := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil)
	session, err := client.Connect(context.Background(), &mcp.StreamableClientTransport{
		Endpoint:             "http://mediago.test/mcp",
		HTTPClient:           authorizedClient,
		DisableStandaloneSSE: true,
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = session.Close() })

	result, err := session.CallTool(context.Background(), &mcp.CallToolParams{Name: "health_check"})
	if err != nil {
		t.Fatal(err)
	}
	if result.IsError || len(result.Content) == 0 {
		t.Fatalf("unexpected health_check result: %+v", result)
	}
}

func serveManagerRequest(t *testing.T, manager *Manager, method, token string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(method, "/mcp", bytes.NewBufferString(`{}`))
	request.Header.Set("Content-Type", "application/json")
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response := httptest.NewRecorder()
	manager.Handler().ServeHTTP(response, request)
	return response
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

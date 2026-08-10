package mcpserver

import (
	"bytes"
	"context"
	"net"
	"net/http"
	"strconv"
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

func TestManagerServesAuthenticatedLoopbackEndpoint(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	_ = listener.Close()

	manager := NewManager(&service.DownloadTaskService{}, testDownloadConfig{})
	if err := manager.Apply(Settings{Enabled: true, Port: port, Token: "secret"}); err != nil {
		t.Fatal(err)
	}
	defer manager.Close()

	endpoint := "http://127.0.0.1:" + strconv.Itoa(port) + "/mcp"
	response, err := http.Post(endpoint, "application/json", bytes.NewBufferString(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	if response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauthorized status = %d", response.StatusCode)
	}

	request, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewBufferString(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer secret")
	response, err = http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	if response.StatusCode == http.StatusUnauthorized {
		t.Fatal("authorized request was rejected")
	}

	authorizedClient := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		request.Header.Set("Authorization", "Bearer secret")
		return http.DefaultTransport.RoundTrip(request)
	})}
	client := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil)
	session, err := client.Connect(context.Background(), &mcp.StreamableClientTransport{
		Endpoint:             endpoint,
		HTTPClient:           authorizedClient,
		DisableStandaloneSSE: true,
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()
	result, err := session.CallTool(context.Background(), &mcp.CallToolParams{Name: "health_check"})
	if err != nil {
		t.Fatal(err)
	}
	if result.IsError || len(result.Content) == 0 {
		t.Fatalf("unexpected health_check result: %+v", result)
	}

	status := manager.Status()
	if !status.Enabled || !status.Running || status.Endpoint != endpoint {
		t.Fatalf("unexpected status: %+v", status)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

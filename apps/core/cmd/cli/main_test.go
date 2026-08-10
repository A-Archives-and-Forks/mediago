package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestAPIClientCreatesPersistedDownload(t *testing.T) {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthy" {
			w.WriteHeader(http.StatusOK)
			return
		}
		if r.URL.Path != "/api/downloads" || r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}
		if got := r.Header.Get("Authorization"); got != "Bearer secret" {
			t.Fatalf("Authorization = %q", got)
		}
		var request createDownloadRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if !request.StartDownload || len(request.Tasks) != 1 {
			t.Fatalf("unexpected request: %+v", request)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"code":200,"data":[{"id":42,"name":"video","status":"pending"}]}`))
	}))
	defer server.Close()

	client, err := newAPIClient(server.URL, "secret")
	if err != nil {
		t.Fatal(err)
	}
	if err := client.health(context.Background()); err != nil {
		t.Fatal(err)
	}
	record, err := client.createDownload(context.Background(), createDownloadTask{
		Type: "m3u8",
		URL:  "https://example.com/video.m3u8",
	})
	if err != nil {
		t.Fatal(err)
	}
	if record.ID != 42 || record.Name != "video" {
		t.Fatalf("unexpected record: %+v", record)
	}
}

func TestLoadConfigDefaultsAndFile(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "missing.json")
	cfg, err := loadConfig(missing)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.BaseURL != defaultBaseURL {
		t.Fatalf("default base URL = %q", cfg.BaseURL)
	}

	path := filepath.Join(t.TempDir(), "cli.json")
	if err := os.WriteFile(path, []byte(`{"baseUrl":"http://localhost:9999","apiKey":"key"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err = loadConfig(path)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.BaseURL != "http://localhost:9999" || cfg.APIKey != "key" {
		t.Fatalf("unexpected config: %+v", cfg)
	}
}

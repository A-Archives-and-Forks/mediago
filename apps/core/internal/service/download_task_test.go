package service

import (
	"slices"
	"testing"
)

func TestParseStoredHeadersMultiline(t *testing.T) {
	raw := "Referer:https://example.com/watch/video\r\nOrigin:https://example.com\r\nUser-Agent:Mozilla/5.0\r\n\r\n"
	want := []string{
		"Referer:https://example.com/watch/video",
		"Origin:https://example.com",
		"User-Agent:Mozilla/5.0",
	}

	if got := parseStoredHeaders(raw); !slices.Equal(got, want) {
		t.Fatalf("parseStoredHeaders() = %v, want %v", got, want)
	}
}

func TestParseStoredHeadersJSON(t *testing.T) {
	raw := `["Referer:https://www.bilibili.com","Cookie:SESSDATA=secret"]`
	want := []string{
		"Referer:https://www.bilibili.com",
		"Cookie:SESSDATA=secret",
	}

	if got := parseStoredHeaders(raw); !slices.Equal(got, want) {
		t.Fatalf("parseStoredHeaders() = %v, want %v", got, want)
	}
}

func TestParseStoredHeadersEmpty(t *testing.T) {
	if got := parseStoredHeaders("\r\n \n"); len(got) != 0 {
		t.Fatalf("parseStoredHeaders() = %v, want empty", got)
	}
}

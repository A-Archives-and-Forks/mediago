package core

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"caorushizi.cn/mediago/internal/core/schema"
	"caorushizi.cn/mediago/internal/logger"
	"go.uber.org/zap"
)

type testDownloaderConfig struct {
	localDir string
}

func (c testDownloaderConfig) GetLocalDir() string   { return c.localDir }
func (testDownloaderConfig) GetDeleteSegments() bool { return true }
func (testDownloaderConfig) GetUseProxy() bool       { return false }
func (testDownloaderConfig) GetProxy() string        { return "" }

type runnerFunc func(context.Context, string, []string, func(string)) error

func (f runnerFunc) Run(ctx context.Context, bin string, args []string, onLine func(string)) error {
	return f(ctx, bin, args, onLine)
}

func ensureTestLogger() {
	if logger.Logger == nil {
		logger.Logger = zap.NewNop()
		logger.Sugar = logger.Logger.Sugar()
	}
}

func TestBuildArgsUsesStoredBilibiliCookie(t *testing.T) {
	d := &DownloaderSvc{}
	s := schema.Schema{Args: map[string]schema.ArgSpec{
		"cookie":     {ArgsName: []string{"--cookie"}},
		"__common__": {ArgsName: []string{"--encoding-priority", "avc,hevc,av1"}},
	}}

	args := d.buildArgs(DownloadParams{
		Type:    TypeBilibili,
		Headers: []string{"Referer: https://www.bilibili.com", "cookie: SESSDATA=secret; bili_jct=csrf"},
	}, s)

	cookieIndex := slices.Index(args, "--cookie")
	if cookieIndex == -1 || cookieIndex+1 >= len(args) {
		t.Fatalf("expected --cookie argument, got %v", args)
	}
	if got := args[cookieIndex+1]; got != "SESSDATA=secret; bili_jct=csrf" {
		t.Fatalf("unexpected cookie value %q", got)
	}
	if slices.Contains(args, "--use-app-api") {
		t.Fatalf("APP API must not be forced: %v", args)
	}
}

func TestBuildArgsOmitsMissingCookie(t *testing.T) {
	d := &DownloaderSvc{}
	s := schema.Schema{Args: map[string]schema.ArgSpec{
		"cookie": {ArgsName: []string{"--cookie"}},
	}}

	args := d.buildArgs(DownloadParams{Type: TypeBilibili}, s)
	if slices.Contains(args, "--cookie") {
		t.Fatalf("unexpected cookie argument: %v", args)
	}
}

func TestRedactSensitiveArgs(t *testing.T) {
	original := []string{"BV1xx", "--cookie", "SESSDATA=secret", "--cookie=other-secret"}
	redacted := redactSensitiveArgs(original)

	want := []string{"BV1xx", "--cookie", "[REDACTED]", "--cookie=[REDACTED]"}
	if !slices.Equal(redacted, want) {
		t.Fatalf("redacted args = %v, want %v", redacted, want)
	}
	if original[2] != "SESSDATA=secret" {
		t.Fatal("redaction mutated executable arguments")
	}
}

func TestHeaderValueIsCaseInsensitive(t *testing.T) {
	headers := []string{"COOKIE : SESSDATA=value:with:colons"}
	if got := headerValue(headers, "Cookie"); got != "SESSDATA=value:with:colons" {
		t.Fatalf("headerValue() = %q", got)
	}
}

func TestBuildArgsPassesSniffedM3U8Headers(t *testing.T) {
	d := &DownloaderSvc{}
	s := schema.Schema{Args: map[string]schema.ArgSpec{
		"headers": {ArgsName: []string{"--header"}},
	}}
	headerLines := []string{
		"Referer:https://example.com/watch/video",
		"Origin:https://example.com",
		"User-Agent:Mozilla/5.0",
	}

	args := d.buildArgs(DownloadParams{Type: TypeM3U8, Headers: headerLines}, s)
	for _, header := range headerLines {
		index := slices.Index(args, header)
		if index < 1 || args[index-1] != "--header" {
			t.Fatalf("expected --header %q in %v", header, args)
		}
	}
}

func TestBuildArgsUsesBundledFFmpeg(t *testing.T) {
	d := &DownloaderSvc{binMap: map[DownloadType]string{
		TypeM3U8: "/opt/mediago/deps/N_m3u8DL-RE",
	}}
	s := schema.Schema{Args: map[string]schema.ArgSpec{
		"ffmpegBinaryPath": {ArgsName: []string{"--ffmpeg-binary-path"}},
	}}

	args := d.buildArgs(DownloadParams{Type: TypeM3U8}, s)
	want := []string{"--ffmpeg-binary-path", "/opt/mediago/deps/ffmpeg"}
	if !slices.Equal(args, want) {
		t.Fatalf("buildArgs() = %v, want %v", args, want)
	}
}

func TestDownloadRejectsM3U8WithoutMergedOutput(t *testing.T) {
	ensureTestLogger()
	tempDir := t.TempDir()
	bin := filepath.Join(tempDir, "N_m3u8DL-RE")
	if err := os.WriteFile(bin, []byte("test"), 0o700); err != nil {
		t.Fatal(err)
	}

	d := NewDownloader(
		map[DownloadType]string{TypeM3U8: bin},
		runnerFunc(func(context.Context, string, []string, func(string)) error { return nil }),
		schema.DefaultSchemas(),
		testDownloaderConfig{localDir: tempDir},
	)
	err := d.Download(context.Background(), DownloadParams{
		ID: "1", Type: TypeM3U8, URL: "https://example.com/video.m3u8", Name: "video",
	}, Callbacks{})

	if !errors.Is(err, ErrM3U8OutputMissing) {
		t.Fatalf("Download() error = %v, want ErrM3U8OutputMissing", err)
	}
}

func TestDownloadAcceptsNewMergedM3U8Output(t *testing.T) {
	ensureTestLogger()
	tempDir := t.TempDir()
	bin := filepath.Join(tempDir, "N_m3u8DL-RE")
	if err := os.WriteFile(bin, []byte("test"), 0o700); err != nil {
		t.Fatal(err)
	}

	d := NewDownloader(
		map[DownloadType]string{TypeM3U8: bin},
		runnerFunc(func(context.Context, string, []string, func(string)) error {
			return os.WriteFile(filepath.Join(tempDir, "video.mp4"), []byte("merged"), 0o600)
		}),
		schema.DefaultSchemas(),
		testDownloaderConfig{localDir: tempDir},
	)
	err := d.Download(context.Background(), DownloadParams{
		ID: "1", Type: TypeM3U8, URL: "https://example.com/video.m3u8", Name: "video",
	}, Callbacks{})

	if err != nil {
		t.Fatalf("Download() error = %v", err)
	}
}

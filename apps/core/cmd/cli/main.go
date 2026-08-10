package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

const defaultBaseURL = "http://127.0.0.1:39719"

var version = "dev"

type cliConfig struct {
	BaseURL string `json:"baseUrl"`
	APIKey  string `json:"apiKey"`
}

type apiEnvelope[T any] struct {
	Success bool   `json:"success"`
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

type downloadRecord struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
	File   string `json:"file"`
}

type runtimeTask struct {
	Status  string  `json:"status"`
	Percent float64 `json:"percent"`
	Speed   string  `json:"speed"`
	Error   string  `json:"error"`
}

type createDownloadRequest struct {
	Tasks         []createDownloadTask `json:"tasks"`
	StartDownload bool                 `json:"startDownload"`
}

type createDownloadTask struct {
	Type    string  `json:"type"`
	URL     string  `json:"url"`
	Name    string  `json:"name,omitempty"`
	Folder  *string `json:"folder,omitempty"`
	Headers *string `json:"headers,omitempty"`
}

type apiClient struct {
	baseURL string
	apiKey  string
	http    *http.Client
}

func main() {
	if err := newRootCommand().Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func newRootCommand() *cobra.Command {
	var baseURL string
	var apiKey string
	var configPath string

	rootCmd := &cobra.Command{
		Use:     "mediago",
		Short:   "Control a running MediaGo service",
		Version: version,
		Long: "MediaGo CLI creates downloads through the MediaGo HTTP API. " +
			"The desktop app, Docker service, or another MediaGo server must be running.",
		PersistentPreRunE: func(cmd *cobra.Command, _ []string) error {
			cfg, err := loadConfig(configPath)
			if err != nil {
				return err
			}
			if !cmd.Flags().Changed("base-url") && !cmd.InheritedFlags().Changed("base-url") {
				baseURL = cfg.BaseURL
			}
			if !cmd.Flags().Changed("api-key") && !cmd.InheritedFlags().Changed("api-key") {
				apiKey = cfg.APIKey
			}
			if value := os.Getenv("MEDIAGO_BASE_URL"); value != "" {
				baseURL = value
			}
			if value := os.Getenv("MEDIAGO_API_KEY"); value != "" {
				apiKey = value
			}
			client, err := newAPIClient(baseURL, apiKey)
			if err != nil {
				return err
			}
			cmd.SetContext(context.WithValue(cmd.Context(), apiClientKey{}, client))
			return nil
		},
	}

	defaultConfigPath, _ := executableConfigPath()
	rootCmd.PersistentFlags().StringVar(&baseURL, "base-url", defaultBaseURL, "MediaGo service URL")
	rootCmd.PersistentFlags().StringVar(&apiKey, "api-key", "", "MediaGo API key")
	rootCmd.PersistentFlags().StringVar(&configPath, "config", defaultConfigPath, "Path to cli.json")
	rootCmd.AddCommand(newDownloadCommand())
	return rootCmd
}

type apiClientKey struct{}

func newDownloadCommand() *cobra.Command {
	var typ string
	var name string
	var folder string
	var headers []string
	var noWait bool

	cmd := &cobra.Command{
		Use:   "download <url>",
		Short: "Create and start a MediaGo download",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			client, ok := cmd.Context().Value(apiClientKey{}).(*apiClient)
			if !ok {
				return errors.New("MediaGo API client was not initialized")
			}
			if err := client.health(cmd.Context()); err != nil {
				return fmt.Errorf("MediaGo is unavailable at %s: %w", client.baseURL, err)
			}

			record, err := client.createDownload(cmd.Context(), createDownloadTask{
				Type:    typ,
				URL:     args[0],
				Name:    name,
				Folder:  optionalString(folder),
				Headers: encodedHeaders(headers),
			})
			if err != nil {
				return err
			}

			fmt.Printf("Created download #%d: %s\n", record.ID, record.Name)
			if noWait {
				return nil
			}

			ctx, stop := signal.NotifyContext(cmd.Context(), os.Interrupt)
			defer stop()
			err = client.monitorDownload(ctx, record)
			if errors.Is(err, context.Canceled) {
				stopCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				if stopErr := client.stopDownload(stopCtx, record.ID); stopErr != nil {
					return fmt.Errorf("interrupt received; could not stop download #%d: %w", record.ID, stopErr)
				}
				fmt.Printf("\nStopped download #%d\n", record.ID)
				return nil
			}
			return err
		},
	}

	cmd.Flags().StringVarP(&typ, "type", "t", "m3u8", "Download type (m3u8, bilibili, direct, mediago, youtube)")
	cmd.Flags().StringVarP(&name, "name", "n", "", "Output file name")
	cmd.Flags().StringVar(&folder, "folder", "", "Subdirectory under MediaGo's download directory")
	cmd.Flags().StringArrayVarP(&headers, "header", "H", nil, "HTTP header, can be repeated")
	cmd.Flags().BoolVar(&noWait, "no-wait", false, "Return immediately after creating the download")
	return cmd
}

func newAPIClient(rawBaseURL, apiKey string) (*apiClient, error) {
	rawBaseURL = strings.TrimRight(strings.TrimSpace(rawBaseURL), "/")
	parsed, err := url.Parse(rawBaseURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("invalid MediaGo base URL %q", rawBaseURL)
	}
	return &apiClient{
		baseURL: rawBaseURL,
		apiKey:  apiKey,
		http:    &http.Client{Timeout: 15 * time.Second},
	}, nil
}

func (c *apiClient) health(ctx context.Context) error {
	req, err := c.newRequest(ctx, http.MethodGet, "/healthy", nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return responseError(resp)
	}
	return nil
}

func (c *apiClient) createDownload(ctx context.Context, task createDownloadTask) (downloadRecord, error) {
	var result apiEnvelope[[]downloadRecord]
	err := c.doJSON(ctx, http.MethodPost, "/api/downloads", createDownloadRequest{
		Tasks:         []createDownloadTask{task},
		StartDownload: true,
	}, &result)
	if err != nil {
		return downloadRecord{}, err
	}
	if len(result.Data) != 1 {
		return downloadRecord{}, errors.New("MediaGo returned an empty download record")
	}
	return result.Data[0], nil
}

func (c *apiClient) getRuntimeTask(ctx context.Context, id int64) (runtimeTask, error) {
	var result apiEnvelope[runtimeTask]
	err := c.doJSON(ctx, http.MethodGet, "/api/tasks/"+strconv.FormatInt(id, 10), nil, &result)
	return result.Data, err
}

func (c *apiClient) getDownload(ctx context.Context, id int64) (downloadRecord, error) {
	var result apiEnvelope[downloadRecord]
	err := c.doJSON(ctx, http.MethodGet, "/api/downloads/"+strconv.FormatInt(id, 10), nil, &result)
	return result.Data, err
}

func (c *apiClient) stopDownload(ctx context.Context, id int64) error {
	return c.doJSON(ctx, http.MethodPost, "/api/downloads/"+strconv.FormatInt(id, 10)+"/stop", struct{}{}, nil)
}

func (c *apiClient) monitorDownload(ctx context.Context, record downloadRecord) error {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	lastLine := ""
	for {
		task, taskErr := c.getRuntimeTask(ctx, record.ID)
		if taskErr == nil {
			line := fmt.Sprintf("%3.0f%%", task.Percent)
			if task.Speed != "" {
				line += " " + task.Speed
			}
			if line != lastLine {
				fmt.Printf("\r%-48s", line)
				lastLine = line
			}
			switch task.Status {
			case "success":
				latest, _ := c.getDownload(ctx, record.ID)
				fmt.Printf("\rDownload #%d completed", record.ID)
				if latest.File != "" {
					fmt.Printf(": %s", latest.File)
				}
				fmt.Println()
				return nil
			case "failed":
				fmt.Println()
				if task.Error == "" {
					task.Error = "download failed"
				}
				return errors.New(task.Error)
			case "stopped":
				fmt.Println()
				return errors.New("download stopped")
			}
		} else {
			latest, downloadErr := c.getDownload(ctx, record.ID)
			if downloadErr != nil {
				return taskErr
			}
			switch latest.Status {
			case "success":
				fmt.Printf("\rDownload #%d completed\n", record.ID)
				return nil
			case "failed", "stopped":
				fmt.Println()
				return fmt.Errorf("download %s", latest.Status)
			}
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func (c *apiClient) doJSON(ctx context.Context, method, path string, body, target any) error {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(data)
	}
	req, err := c.newRequest(ctx, method, path, reader)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return responseError(resp)
	}
	if target == nil {
		return nil
	}
	if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
		return fmt.Errorf("decode MediaGo response: %w", err)
	}
	return nil
}

func (c *apiClient) newRequest(ctx context.Context, method, path string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	return req, nil
}

func responseError(resp *http.Response) error {
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	var payload struct {
		Message string `json:"message"`
	}
	if json.Unmarshal(data, &payload) == nil && payload.Message != "" {
		return fmt.Errorf("MediaGo API returned %s: %s", resp.Status, payload.Message)
	}
	message := strings.TrimSpace(string(data))
	if message == "" {
		message = resp.Status
	}
	return fmt.Errorf("MediaGo API returned %s: %s", resp.Status, message)
}

func loadConfig(path string) (cliConfig, error) {
	cfg := cliConfig{BaseURL: defaultBaseURL}
	if path == "" {
		return cfg, nil
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return cfg, nil
	}
	if err != nil {
		return cfg, fmt.Errorf("read CLI config %s: %w", path, err)
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("parse CLI config %s: %w", path, err)
	}
	if strings.TrimSpace(cfg.BaseURL) == "" {
		cfg.BaseURL = defaultBaseURL
	}
	return cfg, nil
}

func executableConfigPath() (string, error) {
	executable, err := os.Executable()
	if err != nil {
		return "", err
	}
	executable, err = filepath.EvalSymlinks(executable)
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(executable), "cli.json"), nil
}

func encodedHeaders(headers []string) *string {
	if len(headers) == 0 {
		return nil
	}
	data, _ := json.Marshal(headers)
	value := string(data)
	return &value
}

func optionalString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

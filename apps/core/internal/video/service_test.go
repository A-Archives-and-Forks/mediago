package video

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"caorushizi.cn/mediago/internal/db"
	"caorushizi.cn/mediago/internal/db/repo"
	"caorushizi.cn/mediago/internal/tasklog"
)

func createVideoServiceTestOutput(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("media"), 0o600); err != nil {
		t.Fatal(err)
	}
}

func newVideoServiceTestRepository(t *testing.T) *repo.VideoRepository {
	t.Helper()
	database, err := db.New(filepath.Join(t.TempDir(), "mediago.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })
	return repo.NewVideoRepository(database)
}

func TestGetVideoFilePathUsesPersistedOutputOutsideConfiguredRoot(t *testing.T) {
	videoRepo := newVideoServiceTestRepository(t)
	want := filepath.Join(t.TempDir(), "actual-output.mp4")
	createVideoServiceTestOutput(t, want)
	record, err := videoRepo.Create(&db.Video{
		Name:       "display-title",
		Type:       "youtube",
		URL:        "https://example.com/video",
		Status:     "success",
		OutputPath: want,
	})
	if err != nil {
		t.Fatal(err)
	}

	got, err := NewService(videoRepo, t.TempDir(), nil).GetVideoFilePath(record.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("GetVideoFilePath() = %q, want %q", got, want)
	}
}

func TestGetVideoFilePathBackfillsLegacyPathFromTaskLog(t *testing.T) {
	videoRepo := newVideoServiceTestRepository(t)
	logs := tasklog.NewManager(filepath.Join(t.TempDir(), "logs"))
	name := "@creator · legacy.video"
	want := filepath.Join(t.TempDir(), name)
	createVideoServiceTestOutput(t, want)
	record, err := videoRepo.Create(&db.Video{
		Name:   name,
		Type:   "youtube",
		URL:    "https://example.com/legacy",
		Status: "success",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := logs.Append(strconv.FormatInt(record.ID, 10), "[download] Destination: "+want); err != nil {
		t.Fatal(err)
	}

	got, err := NewService(videoRepo, t.TempDir(), logs).GetVideoFilePath(record.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("GetVideoFilePath() = %q, want %q", got, want)
	}
	stored, err := videoRepo.FindByIDOrFail(record.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.OutputPath != want {
		t.Fatalf("backfilled outputPath = %q, want %q", stored.OutputPath, want)
	}
}

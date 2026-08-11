import assert from "node:assert/strict";
import test from "node:test";
import {
  appendStagedMediaFiles,
  createStagedMediaFile,
  getConversionErrorKey,
  getConversionStatusKey,
  getPathExtension,
  getPathFileName,
  isConversionCancelled,
} from "./converter-page-logic";

test("extracts file names and extensions from Windows and POSIX paths", () => {
  assert.equal(getPathFileName("C:\\Media\\demo.MP4"), "demo.MP4");
  assert.equal(getPathFileName("/media/episode.wav"), "episode.wav");
  assert.equal(getPathExtension("C:\\Media\\demo.MP4"), "mp4");
});

test("classifies supported video and audio files", () => {
  assert.deepEqual(createStagedMediaFile("C:\\Media\\demo.mp4"), {
    path: "C:\\Media\\demo.mp4",
    name: "demo.mp4",
    extension: "mp4",
    kind: "video",
  });
  assert.equal(createStagedMediaFile("C:\\Media\\notes.txt"), null);
  assert.equal(createStagedMediaFile(""), null);
});

test("adds unique media files while reporting duplicates and invalid files", () => {
  const first = createStagedMediaFile("C:\\Media\\demo.mp4");
  assert.ok(first);

  const result = appendStagedMediaFiles(
    [first],
    ["c:/media/DEMO.mp4", "C:\\Media\\episode.wav", "C:\\Media\\notes.txt"],
  );

  assert.equal(result.added, 1);
  assert.equal(result.duplicates, 1);
  assert.equal(result.rejected, 1);
  assert.equal(result.files.length, 2);
});

test("maps backend conversion statuses to converter-specific labels", () => {
  assert.equal(getConversionStatusKey("pending"), "conversionStatusPending");
  assert.equal(getConversionStatusKey("done"), "conversionStatusDone");
  assert.equal(getConversionStatusKey("unexpected"), "conversionStatusUnknown");
  assert.equal(
    getConversionStatusKey("failed", "conversion cancelled"),
    "conversionStatusCancelled",
  );
});

test("normalizes backend conversion errors for localized presentation", () => {
  assert.equal(isConversionCancelled("cancelled by user"), true);
  assert.equal(isConversionCancelled("conversion cancelled"), true);
  assert.equal(
    getConversionErrorKey("ffmpeg binary path not configured"),
    "conversionErrorUnavailable",
  );
  assert.equal(
    getConversionErrorKey("failed to start ffmpeg: access denied"),
    "conversionErrorStartFailed",
  );
  assert.equal(
    getConversionErrorKey("source file has no audio stream"),
    "conversionErrorNoAudioStream",
  );
  assert.equal(
    getConversionErrorKey("ffmpeg failed: exit status 1"),
    "conversionErrorUnknown",
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { filterSources } from "./source-filter";

const sources = [
  {
    id: 1,
    name: "Episode One",
    url: "https://media.example.com/episode-1.m3u8",
    documentURL: "https://example.com/series",
  },
  {
    id: 2,
    name: "幕后花絮",
    url: "https://cdn.example.org/bonus.mp4",
    documentURL: "https://example.org/BONUS",
  },
];

test("returns the original source list for a blank query", () => {
  assert.equal(filterSources(sources, "   "), sources);
});

test("filters source names and URLs without case sensitivity", () => {
  assert.deepEqual(filterSources(sources, "EPISODE"), [sources[0]]);
  assert.deepEqual(filterSources(sources, "bonus.MP4"), [sources[1]]);
  assert.deepEqual(filterSources(sources, " example.org/bonus "), [sources[1]]);
});

test("returns an empty list when no source matches", () => {
  assert.deepEqual(filterSources(sources, "trailer"), []);
});

import assert from "node:assert/strict";
import { deduplicateRepositories } from "./lib/collection/dedupe";
import type { CollectedRepository } from "./lib/collection/types";

const repo = (id: number, fullName: string): CollectedRepository => ({
  id,
  name: fullName.split("/")[1],
  fullName,
  url: `https://github.com/${fullName}`,
  description: null,
  private: false,
  fork: false,
  archived: false,
  language: "TypeScript",
  stars: 1,
  watchers: 1,
  forks: 0,
  openIssues: 0,
  topics: [],
  defaultBranch: "main",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  pushedAt: null,
  homepage: null,
  license: null,
  owner: {
    login: fullName.split("/")[0],
    avatarUrl: "",
    url: `https://github.com/${fullName.split("/")[0]}`,
  },
});

const result = deduplicateRepositories([
  repo(1, "alice/one"),
  repo(2, "bob/two"),
  repo(1, "alice/one"),
  repo(3, "carol/three"),
  repo(2, "bob/two"),
]);

assert.equal(result.unique.length, 3);
assert.equal(result.duplicatesSkipped, 2);
assert.deepEqual(
  result.unique.map((item) => item.fullName),
  ["alice/one", "bob/two", "carol/three"],
);

console.log("Phase 5 deduplication test passed.");

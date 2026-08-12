/**
 * Phase 5 — pure deduplication helpers.
 *
 * These helpers are intentionally independent of the filesystem so they can
 * be unit-tested and reused by future CSV/export pipelines.
 */

import type { CollectedRepository } from "./types";
export function repositoryIdentity(repository: CollectedRepository): string {
  if (Number.isFinite(repository.id)) {
    return `id:${repository.id}`;
  }

  return `fullName:${repository.fullName.trim().toLowerCase()}`;
}

export interface DedupeResult {
  unique: CollectedRepository[];
  duplicatesSkipped: number;
}

export function deduplicateRepositories(
  repositories: CollectedRepository[],
): DedupeResult {
  const seen = new Set<string>();
  const unique: CollectedRepository[] = [];
  let duplicatesSkipped = 0;

  for (const repository of repositories) {
    const identity = repositoryIdentity(repository);

    if (seen.has(identity)) {
      duplicatesSkipped += 1;
      continue;
    }

    seen.add(identity);
    unique.push(repository);
  }

  return { unique, duplicatesSkipped };
}

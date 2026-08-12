/**
 * Phase 6 — Large CSV Generation
 *
 * Converts the server-side deduplicated repository records into one CSV
 * while preserving the v0.1 export schema.
 */

import type { CollectedRepository } from "./types";

export const CSV_HEADERS = [
  "Repository",
  "Owner",
  "Description",
  "Stars",
  "Forks",
  "Language",
  "Open Issues",
  "Topics",
  "Archived",
  "Fork",
  "Private",
  "Default Branch",
  "License",
  "License SPDX",
  "Homepage",
  "GitHub URL",
  "Owner Avatar",
  "Created At",
  "Updated At",
  "Pushed At",
];

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function topicsToCsv(topics: string[]): string {
  return topics.join(", ");
}

function licenseName(
  repository: CollectedRepository,
): string {
  return repository.license?.name ?? "";
}

function licenseSpdx(
  repository: CollectedRepository,
): string {
  return repository.license?.spdxId ?? "";
}

export function repositoryToCsvRow(
  repository: CollectedRepository,
): string {
  return [
    repository.name,
    repository.owner.login,
    repository.description ?? "",
    repository.stars,
    repository.forks,
    repository.language ?? "",
    repository.openIssues,
    topicsToCsv(repository.topics),
    repository.archived,
    repository.fork,
    repository.private,
    repository.defaultBranch,
    licenseName(repository),
    licenseSpdx(repository),
    repository.homepage ?? "",
    repository.url,
    repository.owner.avatarUrl,
    repository.createdAt,
    repository.updatedAt,
    repository.pushedAt ?? "",
  ]
    .map(escapeCsv)
    .join(",");
}

/**
 * Generates the complete CSV in one string.
 *
 * This is appropriate for the current v0.2 target of up to 9,999 records.
 * If future datasets become substantially larger, Phase 7+ can replace this
 * with a streaming/file-backed implementation.
 */
export function generateRepositoriesCsv(
  repositories: CollectedRepository[],
): string {
  const lines = [
    CSV_HEADERS.map(escapeCsv).join(","),
    ...repositories.map(repositoryToCsvRow),
  ];

  return `${lines.join("\r\n")}\r\n`;
}

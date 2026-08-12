/**
 * Phase 3 — Large-Scale Collection Engine
 *
 * This module executes a Phase 2 PartitionPlan against GitHub's
 * repository-search REST endpoint.
 *
 * Important:
 * - GitHub is queried directly from server-side code.
 * - GITHUB_TOKEN is never accepted from the browser.
 * - Each individual search partition is limited to the practical
 *   search window for that query.
 * - Phase 5 will add global deduplication.
 * - Phase 4 will add persistent/server-side progress jobs.
 * - Phase 7 will add durable resume/retry behavior.
 */

import type {
  CollectedRepository,
  CollectionOptions,
  CollectionResult,
  CollectionStats,
  PartitionPlan,
  QueryPartition,
} from "./types";

const GITHUB_SEARCH_URL =
  "https://api.github.com/search/repositories";

const GITHUB_API_VERSION = "2026-03-10";

/**
 * GitHub repository search exposes a practical result window per query.
 * The current v0.1 API already uses 1000, so Phase 3 keeps the same
 * per-partition boundary and aggregates across partitions.
 */
const PER_PARTITION_SEARCH_LIMIT = 1000;

const DEFAULT_MAX_RESULTS = 9999;
const DEFAULT_MAX_RESULTS_PER_PARTITION =
  PER_PARTITION_SEARCH_LIMIT;
const DEFAULT_PER_PAGE = 100;
const DEFAULT_MAX_PAGES_PER_PARTITION = 10;

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  language: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics?: string[];
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  homepage: string | null;
  license: {
    key: string;
    name: string;
    spdx_id: string | null;
  } | null;
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
}

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepository[];
}

export function normalizeRepository(
  repository: GitHubRepository,
): CollectedRepository {
  return {
    id: repository.id,
    name: repository.name,
    fullName: repository.full_name,
    url: repository.html_url,
    description: repository.description,
    private: repository.private,
    fork: repository.fork,
    archived: repository.archived,
    language: repository.language,
    stars: repository.stargazers_count,
    watchers: repository.watchers_count,
    forks: repository.forks_count,
    openIssues: repository.open_issues_count,
    topics: repository.topics ?? [],
    defaultBranch: repository.default_branch,
    createdAt: repository.created_at,
    updatedAt: repository.updated_at,
    pushedAt: repository.pushed_at,
    homepage: repository.homepage,
    license: repository.license
      ? {
          key: repository.license.key,
          name: repository.license.name,
          spdxId: repository.license.spdx_id,
        }
      : null,
    owner: {
      login: repository.owner.login,
      avatarUrl: repository.owner.avatar_url,
      url: repository.owner.html_url,
    },
  };
}

function getResetTimestamp(response: Response): number | null {
  const value = response.headers.get("x-ratelimit-reset");

  if (!value) return null;

  const timestamp = Number(value);

  return Number.isFinite(timestamp) ? timestamp : null;
}

function getRemainingRateLimit(response: Response): number | null {
  const value = response.headers.get("x-ratelimit-remaining");

  if (!value) return null;

  const remaining = Number(value);

  return Number.isFinite(remaining) ? remaining : null;
}

function throwGitHubError(
  response: Response,
  data: unknown,
  partition: QueryPartition,
  page: number,
): never {
  const body =
    typeof data === "object" && data !== null
      ? data as { message?: string }
      : {};

  const reset = getResetTimestamp(response);

  if (response.status === 401) {
    throw new Error(
      "GitHub authentication failed. Check GITHUB_TOKEN.",
    );
  }

  if (response.status === 403 || response.status === 429) {
    let message =
      body.message ||
      "GitHub API rate limit or access restriction reached.";

    if (reset) {
      message += ` Try again after ${new Date(
        reset * 1000,
      ).toLocaleTimeString()}.`;
    }

    throw new Error(
      `${message} Partition "${partition.label}", page ${page}.`,
    );
  }

  if (response.status === 422) {
    throw new Error(
      `GitHub rejected partition "${partition.label}" on page ${page}.`,
    );
  }

  throw new Error(
    body.message ||
      `GitHub request failed with HTTP ${response.status}. ` +
        `Partition "${partition.label}", page ${page}.`,
  );
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Collection was cancelled.");
  }
}

export async function fetchPartitionPage(
  partition: QueryPartition,
  page: number,
  perPage: number,
  token: string,
  signal?: AbortSignal,
): Promise<{
  repositories: CollectedRepository[];
  totalCount: number;
  incompleteResults: boolean;
}> {
  assertNotAborted(signal);

  const url = new URL(GITHUB_SEARCH_URL);

  url.searchParams.set("q", partition.query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": "github-repository-search-tool",
    },
    cache: "no-store",
    signal,
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    throwGitHubError(response, data, partition, page);
  }

  const githubData = data as GitHubSearchResponse;

  return {
    repositories: githubData.items.map(normalizeRepository),
    totalCount: githubData.total_count,
    incompleteResults: githubData.incomplete_results,
  };
}

async function collectPartition(
  partition: QueryPartition,
  remainingTarget: number,
  options: Required<
    Pick<
      CollectionOptions,
      | "maxResultsPerPartition"
      | "perPage"
      | "maxPagesPerPartition"
    >
  > & { signal?: AbortSignal },
  token: string,
): Promise<{
  repositories: CollectedRepository[];
  pagesFetched: number;
  incompleteResults: boolean;
}> {
  const repositories: CollectedRepository[] = [];
  let pagesFetched = 0;
  let incompleteResults = false;

  const partitionLimit = Math.min(
    options.maxResultsPerPartition,
    PER_PARTITION_SEARCH_LIMIT,
    remainingTarget,
  );

  if (partitionLimit <= 0) {
    return {
      repositories,
      pagesFetched,
      incompleteResults,
    };
  }

  const pagesNeeded = Math.ceil(
    partitionLimit / options.perPage,
  );

  const pagesToFetch = Math.min(
    pagesNeeded,
    options.maxPagesPerPartition,
    Math.ceil(
      PER_PARTITION_SEARCH_LIMIT / options.perPage,
    ),
  );

  for (let page = 1; page <= pagesToFetch; page++) {
    assertNotAborted(options.signal);

    const remainingPartitionResults =
      partitionLimit - repositories.length;

    if (remainingPartitionResults <= 0) {
      break;
    }

    const pageSize = Math.min(
      options.perPage,
      remainingPartitionResults,
    );

    const result = await fetchPartitionPage(
      partition,
      page,
      pageSize,
      token,
      options.signal,
    );

    pagesFetched += 1;
    incompleteResults ||= result.incompleteResults;

    repositories.push(...result.repositories);

    if (result.repositories.length < pageSize) {
      break;
    }
  }

  return {
    repositories,
    pagesFetched,
    incompleteResults,
  };
}

/**
 * Execute a complete Phase 2 partition plan.
 *
 * Results are intentionally NOT deduplicated here.
 * Deduplication is Phase 5.
 */
export async function collectPartitionPlan(
  plan: PartitionPlan,
  options: CollectionOptions = {},
): Promise<CollectionResult> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not configured. Add it to .env.local.",
    );
  }

  const requestedMaxResults = Math.min(
    Math.max(1, options.maxResults ?? DEFAULT_MAX_RESULTS),
    DEFAULT_MAX_RESULTS,
  );

  const maxResultsPerPartition = Math.min(
    Math.max(
      1,
      options.maxResultsPerPartition ??
        DEFAULT_MAX_RESULTS_PER_PARTITION,
    ),
    PER_PARTITION_SEARCH_LIMIT,
  );

  const perPage = Math.min(
    Math.max(1, options.perPage ?? DEFAULT_PER_PAGE),
    100,
  );

  const maxPagesPerPartition = Math.min(
    Math.max(
      1,
      options.maxPagesPerPartition ??
        DEFAULT_MAX_PAGES_PER_PARTITION,
    ),
    Math.ceil(
      PER_PARTITION_SEARCH_LIMIT / perPage,
    ),
  );

  const repositories: CollectedRepository[] = [];
  let partitionsProcessed = 0;
  let pagesFetched = 0;
  let incompleteResults = false;
  let stoppedBecauseTargetReached = false;

  for (const partition of plan.partitions) {
    assertNotAborted(options.signal);

    if (repositories.length >= requestedMaxResults) {
      stoppedBecauseTargetReached = true;
      break;
    }

    const remainingTarget =
      requestedMaxResults - repositories.length;

    const result = await collectPartition(
      partition,
      remainingTarget,
      {
        maxResultsPerPartition,
        perPage,
        maxPagesPerPartition,
        signal: options.signal,
      },
      token,
    );

    repositories.push(...result.repositories);
    pagesFetched += result.pagesFetched;
    incompleteResults ||= result.incompleteResults;
    partitionsProcessed += 1;

    if (repositories.length >= requestedMaxResults) {
      stoppedBecauseTargetReached = true;
      break;
    }
  }

  const finalRepositories =
    repositories.length > requestedMaxResults
      ? repositories.slice(0, requestedMaxResults)
      : repositories;

  const stats: CollectionStats = {
    requestedMaxResults,
    collectedResults: finalRepositories.length,
    partitionsProcessed,
    totalPartitions: plan.totalPartitions,
    pagesFetched,
    incompleteResults,
    stoppedBecauseTargetReached,
  };

  return {
    plan,
    repositories: finalRepositories,
    stats,
  };
}

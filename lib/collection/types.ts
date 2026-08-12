/**
 * Phase 2 + Phase 3 — Collection types
 *
 * Phase 2 creates partition plans.
 * Phase 3 executes those plans against GitHub.
 */

export type PartitionStrategy =
  | "none"
  | "language"
  | "date"
  | "hybrid";

export type PartitionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type DatePartitionField = "created" | "updated" | "pushed";

export interface QueryPartition {
  id: string;
  query: string;
  strategy: Exclude<PartitionStrategy, "none">;
  label: string;
  status: PartitionStatus;
  index: number;
  dateRange?: {
    field: DatePartitionField;
    from: string;
    to: string;
  };
  language?: string;
}

export interface PartitionPlan {
  id: string;
  originalQuery: string;
  partitions: QueryPartition[];
  strategy: PartitionStrategy;
  createdAt: string;
  totalPartitions: number;
}

export interface PartitionOptions {
  languages?: string[];
  dateField?: DatePartitionField;
  dateFrom?: string;
  dateTo?: string;
  monthsPerPartition?: number;
  strategy?: PartitionStrategy;
  maxPartitions?: number;
}

/**
 * Normalized repository shape shared with the v0.1/v0.2 search API.
 */
export interface CollectedRepository {
  id: number;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  language: string | null;
  stars: number;
  watchers: number;
  forks: number;
  openIssues: number;
  topics: string[];
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
  homepage: string | null;
  license: {
    key: string;
    name: string;
    spdxId: string | null;
  } | null;
  owner: {
    login: string;
    avatarUrl: string;
    url: string;
  };
}

export interface CollectionOptions {
  /** Maximum raw repository records to collect across all partitions. */
  maxResults?: number;

  /** Maximum records to request from one partition. GitHub search is capped per query. */
  maxResultsPerPartition?: number;

  /** GitHub API page size. GitHub supports a maximum of 100. */
  perPage?: number;

  /** Maximum number of pages to request from one partition. */
  maxPagesPerPartition?: number;

  /** Optional AbortSignal for cancellation by the caller. */
  signal?: AbortSignal;
}

export interface CollectionStats {
  requestedMaxResults: number;
  collectedResults: number;
  partitionsProcessed: number;
  totalPartitions: number;
  pagesFetched: number;
  incompleteResults: boolean;
  stoppedBecauseTargetReached: boolean;
}

export interface CollectionResult {
  plan: PartitionPlan;
  repositories: CollectedRepository[];
  stats: CollectionStats;
}

export type CollectionJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface CollectionJobOptions {
  maxResults: number;
  maxResultsPerPartition: number;
  perPage: number;
  maxPagesPerPartition: number;
}

export interface CollectionJobProgress {
  status: CollectionJobStatus;
  percent: number;
  partitionsTotal: number;
  partitionsCompleted: number;
  currentPartitionIndex: number | null;
  currentPartitionLabel: string | null;
  currentPage: number | null;
  currentPageTotal: number | null;
  pagesFetched: number;
  recordsCollected: number;
  rawRecordsFetched: number;
  duplicatesSkipped: number;
  targetResults: number;
  message: string;
  error: string | null;
  retryCount: number;
  lastFailureAt: string | null;
  updatedAt: string;
}

export interface CollectionJob {
  id: string;
  plan: PartitionPlan;
  options: CollectionJobOptions;
  progress: CollectionJobProgress;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

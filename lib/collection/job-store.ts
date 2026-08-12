/**
 * Phase 5 — server-side job state + global repository deduplication.
 *
 * Each collection job keeps a persistent repository identity index. A
 * repository is considered the same record when its GitHub numeric id is the
 * same; fullName is retained as a defensive fallback for malformed records.
 */

import "server-only";

import {
  appendFile,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { repositoryIdentity } from "./dedupe";

import type {
  CollectedRepository,
  CollectionJob,
  CollectionJobOptions,
  CollectionJobProgress,
  PartitionPlan,
} from "./types";

const JOB_ROOT = path.join(process.cwd(), ".data", "collection-jobs");

function jobDir(jobId: string): string {
  return path.join(JOB_ROOT, jobId);
}

function metaPath(jobId: string): string {
  return path.join(jobDir(jobId), "job.json");
}

function recordsPath(jobId: string): string {
  return path.join(jobDir(jobId), "records.jsonl");
}

function indexPath(jobId: string): string {
  return path.join(jobDir(jobId), "repository-index.json");
}

async function ensureJobDir(jobId: string): Promise<void> {
  await mkdir(jobDir(jobId), { recursive: true });
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), "utf8");
  await rename(temporaryPath, filePath);
}

function createJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function initialProgress(
  plan: PartitionPlan,
  options: CollectionJobOptions,
): CollectionJobProgress {
  return {
    status: "pending",
    percent: 0,
    partitionsTotal: plan.totalPartitions,
    partitionsCompleted: 0,
    currentPartitionIndex: plan.partitions.length ? 0 : null,
    currentPartitionLabel: plan.partitions[0]?.label ?? null,
    currentPage: plan.partitions.length ? 1 : null,
    currentPageTotal: Math.ceil(options.maxResultsPerPartition / options.perPage),
    pagesFetched: 0,
    recordsCollected: 0,
    rawRecordsFetched: 0,
    duplicatesSkipped: 0,
    targetResults: options.maxResults,
    message: "Collection queued.",
    error: null,
    retryCount: 0,
    lastFailureAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function createJob(
  plan: PartitionPlan,
  options: CollectionJobOptions,
): Promise<CollectionJob> {
  const id = createJobId();
  const now = new Date().toISOString();

  const job: CollectionJob = {
    id,
    plan,
    options,
    progress: initialProgress(plan, options),
    createdAt: now,
    startedAt: null,
    completedAt: null,
  };

  await ensureJobDir(id);
  await writeJsonAtomic(metaPath(id), job);
  await writeFile(recordsPath(id), "", "utf8");
  await writeJsonAtomic(indexPath(id), []);

  return job;
}

export async function getJob(jobId: string): Promise<CollectionJob | null> {
  try {
    const content = await readFile(metaPath(jobId), "utf8");
    const job = JSON.parse(content) as CollectionJob;

    // Phase 4 jobs may not have the Phase 5 counters yet. Normalize them so
    // an older in-progress job can still be inspected safely after upgrade.
    job.progress.rawRecordsFetched ??= job.progress.recordsCollected ?? 0;
    job.progress.duplicatesSkipped ??= 0;
    job.progress.retryCount ??= 0;
    job.progress.lastFailureAt ??= null;

    return job;
  } catch {
    return null;
  }
}

export async function saveJob(job: CollectionJob): Promise<void> {
  await ensureJobDir(job.id);
  await writeJsonAtomic(metaPath(job.id), job);
}

export async function updateJob(
  jobId: string,
  updater: (job: CollectionJob) => CollectionJob,
): Promise<CollectionJob> {
  const job = await getJob(jobId);
  if (!job) throw new Error("Collection job was not found.");

  const next = updater(job);
  next.progress.updatedAt = new Date().toISOString();
  await saveJob(next);
  return next;
}

async function readRepositoryIndex(jobId: string): Promise<Set<string>> {
  try {
    const content = await readFile(indexPath(jobId), "utf8");
    const values = JSON.parse(content) as unknown;

    if (!Array.isArray(values)) {
      return new Set<string>();
    }

    return new Set(
      values.filter((value): value is string => typeof value === "string"),
    );
  } catch {
    return new Set<string>();
  }
}

/**
 * Append only repositories not seen anywhere else in this collection job.
 *
 * Returns both the unique records written and the number discarded as
 * duplicates. The identity index is persisted separately so later pages and
 * partitions do not need to scan the entire JSONL file.
 */
export async function appendUniqueRepositories(
  jobId: string,
  repositories: CollectedRepository[],
): Promise<{ added: CollectedRepository[]; duplicatesSkipped: number }> {
  if (!repositories.length) {
    return { added: [], duplicatesSkipped: 0 };
  }

  await ensureJobDir(jobId);

  const seen = await readRepositoryIndex(jobId);
  const added: CollectedRepository[] = [];
  let duplicatesSkipped = 0;

  for (const repository of repositories) {
    const identity = repositoryIdentity(repository);

    if (seen.has(identity)) {
      duplicatesSkipped += 1;
      continue;
    }

    seen.add(identity);
    added.push(repository);
  }

  if (added.length) {
    const lines = added
      .map((repository) => JSON.stringify(repository))
      .join("\n");

    await appendFile(recordsPath(jobId), `${lines}\n`, "utf8");
  }

  await writeJsonAtomic(indexPath(jobId), [...seen]);

  return { added, duplicatesSkipped };
}

/**
 * Backwards-compatible append helper. New collection code should use
 * appendUniqueRepositories so all Phase 5 records pass through the index.
 */
export async function appendRepositories(
  jobId: string,
  repositories: CollectedRepository[],
): Promise<void> {
  await appendUniqueRepositories(jobId, repositories);
}

export async function readRepositories(
  jobId: string,
): Promise<CollectedRepository[]> {
  try {
    const content = await readFile(recordsPath(jobId), "utf8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CollectedRepository);
  } catch {
    return [];
  }
}


/**
 * Cancel a job without deleting its already-collected records.
 * This makes cancellation safe to resume later.
 */
export async function cancelJob(jobId: string): Promise<CollectionJob> {
  return updateJob(jobId, (job) => {
    if (
      job.progress.status === "completed" ||
      job.progress.status === "cancelled"
    ) {
      return job;
    }

    return {
      ...job,
      progress: {
        ...job.progress,
        status: "cancelled",
        message: "Collection cancelled. Collected data is preserved.",
        error: null,
        updatedAt: new Date().toISOString(),
      },
    };
  });
}

/**
 * Prepare a failed/cancelled job to continue from its persisted cursor.
 *
 * No page cursor is reset here. The next call to advanceCollectionJob()
 * continues from the same partition/page that was not successfully committed.
 */
export async function resumeJob(jobId: string): Promise<CollectionJob> {
  return updateJob(jobId, (job) => {
    if (job.progress.status === "completed") {
      return job;
    }

    return {
      ...job,
      progress: {
        ...job.progress,
        status: "pending",
        message: "Collection ready to resume from the saved checkpoint.",
        error: null,
        updatedAt: new Date().toISOString(),
      },
      completedAt: null,
    };
  });
}

/**
 * Prepare a failed job for an explicit retry.
 */
export async function retryJob(jobId: string): Promise<CollectionJob> {
  return updateJob(jobId, (job) => {
    if (job.progress.status !== "failed") {
      return job;
    }

    return {
      ...job,
      progress: {
        ...job.progress,
        status: "pending",
        message: "Retrying from the saved checkpoint.",
        error: null,
        retryCount: (job.progress.retryCount ?? 0) + 1,
        lastFailureAt: job.progress.lastFailureAt ?? null,
        updatedAt: new Date().toISOString(),
      },
      completedAt: null,
    };
  });
}

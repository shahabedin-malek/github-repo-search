/**
 * Phase 4 — one server-side collection work unit.
 *
 * A work unit fetches one GitHub page, persists its records, and advances the
 * server-side job cursor. The browser polls/steps the job, but progress is
 * authoritative in the server job store.
 */

import "server-only";

import {
  appendUniqueRepositories,
  getJob,
  saveJob,
} from "./job-store";
import { fetchPartitionPage } from "./collector";
import type { CollectionJob, QueryPartition } from "./types";

function pageTotal(job: CollectionJob): number {
  return Math.min(
    job.options.maxPagesPerPartition,
    Math.ceil(job.options.maxResultsPerPartition / job.options.perPage),
  );
}

function updateProgressPercent(job: CollectionJob): number {
  const total = Math.max(1, job.progress.partitionsTotal);
  const current = job.progress.currentPartitionIndex ?? 0;
  const pageTotalValue = Math.max(1, job.progress.currentPageTotal ?? pageTotal(job));
  const page = Math.max(0, job.progress.currentPage ?? 0);

  return Math.min(
    100,
    Math.round(((current + page / pageTotalValue) / total) * 100),
  );
}

function nextPartition(job: CollectionJob): QueryPartition | null {
  const index = job.progress.currentPartitionIndex;
  if (index === null) return null;
  return job.plan.partitions[index] ?? null;
}

export async function advanceCollectionJob(jobId: string): Promise<CollectionJob> {
  const job = await getJob(jobId);
  if (!job) throw new Error("Collection job was not found.");

  if (job.progress.status === "completed") {
    return job;
  }

  if (job.progress.status === "cancelled") {
    return job;
  }

  if (!process.env.GITHUB_TOKEN) {
    const failed: CollectionJob = {
      ...job,
      progress: {
        ...job.progress,
        status: "failed",
        error: "GITHUB_TOKEN is not configured. Add it to .env.local.",
        message: "Collection failed.",
        updatedAt: new Date().toISOString(),
      },
      completedAt: new Date().toISOString(),
    };
    await saveJob(failed);
    return failed;
  }

  const partition = nextPartition(job);

  if (!partition || job.progress.recordsCollected >= job.options.maxResults) {
    const completed: CollectionJob = {
      ...job,
      progress: {
        ...job.progress,
        status: "completed",
        percent: 100,
        message: "Collection complete.",
        updatedAt: new Date().toISOString(),
      },
      completedAt: new Date().toISOString(),
    };
    await saveJob(completed);
    return completed;
  }

  const page = job.progress.currentPage ?? 1;
  const remainingTarget = job.options.maxResults - job.progress.recordsCollected;
  const remainingPartition = job.options.maxResultsPerPartition -
    ((page - 1) * job.options.perPage);
  const pageSize = Math.min(
    job.options.perPage,
    remainingTarget,
    remainingPartition,
  );

  const running: CollectionJob = {
    ...job,
    progress: {
      ...job.progress,
      status: "running",
      currentPartitionLabel: partition.label,
      currentPageTotal: pageTotal(job),
      message: `Collecting ${partition.label} — page ${page}.`,
      updatedAt: new Date().toISOString(),
    },
    startedAt: job.startedAt ?? new Date().toISOString(),
  };
  await saveJob(running);

  try {
    const result = await fetchPartitionPage(
      partition,
      page,
      Math.max(1, pageSize),
      process.env.GITHUB_TOKEN,
    );

    const { added, duplicatesSkipped } = await appendUniqueRepositories(
      jobId,
      result.repositories,
    );

    const nextRecords = job.progress.recordsCollected + added.length;
    const nextRawRecords =
      job.progress.rawRecordsFetched + result.repositories.length;
    const nextDuplicates =
      job.progress.duplicatesSkipped + duplicatesSkipped;
    const reachedPartitionLimit =
      page >= pageTotal(job) ||
      result.repositories.length < pageSize;
    const reachedTarget = nextRecords >= job.options.maxResults;
    const partitionCompleted = reachedPartitionLimit || reachedTarget;

    const nextPartitionIndex = partitionCompleted
      ? (job.progress.currentPartitionIndex ?? 0) + 1
      : job.progress.currentPartitionIndex;

    const partitionsCompleted = partitionCompleted
      ? job.progress.partitionsCompleted + 1
      : job.progress.partitionsCompleted;

    const done =
      reachedTarget ||
      nextPartitionIndex === null ||
      nextPartitionIndex >= job.plan.totalPartitions;

    const nextPage = partitionCompleted ? 1 : page + 1;

    const next: CollectionJob = {
      ...running,
      progress: {
        ...running.progress,
        status: done ? "completed" : "running",
        percent: done
          ? 100
          : updateProgressPercent({
              ...running,
              progress: {
                ...running.progress,
                currentPartitionIndex: nextPartitionIndex,
                currentPage: nextPage,
                partitionsCompleted,
                recordsCollected: nextRecords,
              },
            }),
        partitionsCompleted,
        currentPartitionIndex: done ? null : nextPartitionIndex,
        currentPartitionLabel: done
          ? null
          : job.plan.partitions[nextPartitionIndex ?? 0]?.label ?? null,
        currentPage: done ? null : nextPage,
        currentPageTotal: done ? null : pageTotal(job),
        pagesFetched: job.progress.pagesFetched + 1,
        recordsCollected: nextRecords,
        rawRecordsFetched: nextRawRecords,
        duplicatesSkipped: nextDuplicates,
        message: done
          ? `Collection complete: ${nextRecords} unique records collected${duplicatesSkipped ? `; ${duplicatesSkipped} duplicates skipped on this page` : ""}.`
          : partitionCompleted
            ? `Completed ${partition.label}. ${duplicatesSkipped ? `${duplicatesSkipped} duplicates skipped on this page. ` : ""}Moving to the next partition.`
            : `Collected ${nextRecords} unique records${duplicatesSkipped ? `; ${duplicatesSkipped} duplicates skipped on this page` : ""}. Continuing ${partition.label}.`,
        error: null,
        updatedAt: new Date().toISOString(),
      },
      completedAt: done ? new Date().toISOString() : null,
    };

    await saveJob(next);
    return next;
  } catch (error) {
    const failed: CollectionJob = {
      ...running,
      progress: {
        ...running.progress,
        status: "failed",
        error: error instanceof Error ? error.message : "Collection failed.",
        message: "Collection paused because the current work unit failed. Retry or resume to continue from this checkpoint.",
        retryCount: job.progress.retryCount ?? 0,
        lastFailureAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    await saveJob(failed);
    return failed;
  }
}

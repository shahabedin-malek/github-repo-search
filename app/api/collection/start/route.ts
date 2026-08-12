import { NextRequest, NextResponse } from "next/server";

import { createPartitionPlan } from "@/lib/collection/partitioner";
import { createJob } from "@/lib/collection/job-store";
import type { CollectionJobOptions, PartitionOptions } from "@/lib/collection/types";

export const runtime = "nodejs";

const MAX_RESULTS = 9999;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePartitionOptions(value: unknown): PartitionOptions {
  if (!isObject(value)) return {};

  return {
    languages: Array.isArray(value.languages)
      ? value.languages.filter((item): item is string => typeof item === "string")
      : undefined,
    dateField:
      value.dateField === "created" || value.dateField === "updated" || value.dateField === "pushed"
        ? value.dateField
        : undefined,
    dateFrom: typeof value.dateFrom === "string" ? value.dateFrom : undefined,
    dateTo: typeof value.dateTo === "string" ? value.dateTo : undefined,
    monthsPerPartition:
      typeof value.monthsPerPartition === "number" ? value.monthsPerPartition : undefined,
    strategy:
      value.strategy === "none" ||
      value.strategy === "language" ||
      value.strategy === "date" ||
      value.strategy === "hybrid"
        ? value.strategy
        : undefined,
    maxPartitions:
      typeof value.maxPartitions === "number" ? value.maxPartitions : undefined,
  };
}

function parseCollectionOptions(value: unknown): CollectionJobOptions {
  if (!isObject(value)) {
    return {
      maxResults: MAX_RESULTS,
      maxResultsPerPartition: 1000,
      perPage: 100,
      maxPagesPerPartition: 10,
    };
  }

  return {
    maxResults: Math.min(
      MAX_RESULTS,
      Math.max(1, Math.floor(typeof value.maxResults === "number" ? value.maxResults : MAX_RESULTS)),
    ),
    maxResultsPerPartition: Math.min(
      1000,
      Math.max(1, Math.floor(typeof value.maxResultsPerPartition === "number" ? value.maxResultsPerPartition : 1000)),
    ),
    perPage: Math.min(
      100,
      Math.max(1, Math.floor(typeof value.perPage === "number" ? value.perPage : 100)),
    ),
    maxPagesPerPartition: Math.min(
      10,
      Math.max(1, Math.floor(typeof value.maxPagesPerPartition === "number" ? value.maxPagesPerPartition : 10)),
    ),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      query?: unknown;
      partitionOptions?: unknown;
      collectionOptions?: unknown;
    };

    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json({ error: "A search query is required." }, { status: 400 });
    }

    const plan = createPartitionPlan(query, parsePartitionOptions(body.partitionOptions));
    const options = parseCollectionOptions(body.collectionOptions);
    const job = await createJob(plan, options);

    return NextResponse.json({ ok: true, job });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to create collection job." },
      { status: 400 },
    );
  }
}

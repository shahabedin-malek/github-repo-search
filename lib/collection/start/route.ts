import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  collectPartitionPlan,
} from "@/lib/collection/collector";

import {
  createPartitionPlan,
} from "@/lib/collection/partitioner";

import type {
  CollectionOptions,
  PartitionOptions,
} from "@/lib/collection/types";

/**
 * Phase 3 collection endpoint.
 *
 * POST /api/collection/start
 *
 * Body:
 * {
 *   "query": "ai agent",
 *   "partitionOptions": {
 *     "strategy": "language"
 *   },
 *   "collectionOptions": {
 *     "maxResults": 9999
 *   }
 * }
 *
 * This endpoint executes the collection on the server.
 * Phase 4 will move this into a persistent/background job model.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

const ABSOLUTE_MAX_RESULTS = 9999;

interface StartCollectionBody {
  query?: unknown;
  partitionOptions?: unknown;
  collectionOptions?: unknown;
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parsePartitionOptions(
  value: unknown,
): PartitionOptions {
  if (!isObject(value)) {
    return {};
  }

  return {
    languages: Array.isArray(value.languages)
      ? value.languages.filter(
          (item): item is string =>
            typeof item === "string",
        )
      : undefined,

    dateField:
      value.dateField === "created" ||
      value.dateField === "updated" ||
      value.dateField === "pushed"
        ? value.dateField
        : undefined,

    dateFrom:
      typeof value.dateFrom === "string"
        ? value.dateFrom
        : undefined,

    dateTo:
      typeof value.dateTo === "string"
        ? value.dateTo
        : undefined,

    monthsPerPartition:
      typeof value.monthsPerPartition === "number"
        ? value.monthsPerPartition
        : undefined,

    strategy:
      value.strategy === "none" ||
      value.strategy === "language" ||
      value.strategy === "date" ||
      value.strategy === "hybrid"
        ? value.strategy
        : undefined,

    maxPartitions:
      typeof value.maxPartitions === "number"
        ? value.maxPartitions
        : undefined,
  };
}

function parseCollectionOptions(
  value: unknown,
): Omit<CollectionOptions, "signal"> {
  if (!isObject(value)) {
    return {};
  }

  const maxResults =
    typeof value.maxResults === "number"
      ? Math.min(
          Math.max(1, Math.floor(value.maxResults)),
          ABSOLUTE_MAX_RESULTS,
        )
      : undefined;

  const maxResultsPerPartition =
    typeof value.maxResultsPerPartition === "number"
      ? Math.floor(value.maxResultsPerPartition)
      : undefined;

  const perPage =
    typeof value.perPage === "number"
      ? Math.floor(value.perPage)
      : undefined;

  const maxPagesPerPartition =
    typeof value.maxPagesPerPartition === "number"
      ? Math.floor(value.maxPagesPerPartition)
      : undefined;

  return {
    maxResults,
    maxResultsPerPartition,
    perPage,
    maxPagesPerPartition,
  };
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      (await request.json()) as StartCollectionBody;

    const query =
      typeof body.query === "string"
        ? body.query.trim()
        : "";

    if (!query) {
      return NextResponse.json(
        {
          error: "A search query is required.",
        },
        { status: 400 },
      );
    }

    const partitionOptions =
      parsePartitionOptions(
        body.partitionOptions,
      );

    const collectionOptions =
      parseCollectionOptions(
        body.collectionOptions,
      );

    const plan = createPartitionPlan(
      query,
      partitionOptions,
    );

    const result =
      await collectPartitionPlan(
        plan,
        {
          ...collectionOptions,
          signal: request.signal,
        },
      );

    return NextResponse.json({
      ok: true,
      plan: result.plan,
      repositories: result.repositories,
      stats: result.stats,
    });
  } catch (error) {
    console.error(
      "Collection request failed:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to collect repositories.";

    const status =
      message.includes(
        "GITHUB_TOKEN is not configured",
      )
        ? 500
        : 400;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status },
    );
  }
}

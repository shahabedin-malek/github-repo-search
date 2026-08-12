import { NextRequest, NextResponse } from "next/server";
import { generateRepositoriesCsv } from "@/lib/collection/csv";
import type { CollectedRepository } from "@/lib/collection/types";

/**
 * Phase 6 — Large CSV export endpoint.
 *
 * POST /api/collection/csv
 *
 * Body:
 * {
 *   "repositories": [...]
 * }
 *
 * The endpoint accepts the already collected/deduplicated records.
 * Phase 5 remains responsible for deduplication.
 */
export const runtime = "nodejs";

const MAX_RECORDS = 9999;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || !Array.isArray(body.repositories)) {
      return NextResponse.json(
        {
          ok: false,
          error: "repositories must be an array.",
        },
        { status: 400 },
      );
    }

    if (body.repositories.length > MAX_RECORDS) {
      return NextResponse.json(
        {
          ok: false,
          error: `CSV export is limited to ${MAX_RECORDS} repositories.`,
        },
        { status: 400 },
      );
    }

    const csv = generateRepositoriesCsv(
      body.repositories as CollectedRepository[],
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="github-repositories.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Large CSV generation failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate CSV.",
      },
      { status: 500 },
    );
  }
}

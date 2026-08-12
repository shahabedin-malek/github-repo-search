import { NextRequest, NextResponse } from "next/server";
import { retryJob } from "@/lib/collection/job-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { jobId?: unknown };
    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";

    if (!jobId) {
      return NextResponse.json(
        { ok: false, error: "Collection job id is required." },
        { status: 400 },
      );
    }

    const job = await retryJob(jobId);

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      progress: job.progress,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to retry collection job.",
      },
      { status: 400 },
    );
  }
}

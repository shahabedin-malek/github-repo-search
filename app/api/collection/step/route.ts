import { NextRequest, NextResponse } from "next/server";
import { advanceCollectionJob } from "@/lib/collection/job-worker";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { jobId?: unknown };
    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";

    if (!jobId) {
      return NextResponse.json({ error: "Collection job id is required." }, { status: 400 });
    }

    const job = await advanceCollectionJob(jobId);

    return NextResponse.json({ ok: true, job });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to advance collection job." },
      { status: 400 },
    );
  }
}

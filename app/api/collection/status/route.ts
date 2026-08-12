import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/collection/job-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("id")?.trim();

  if (!jobId) {
    return NextResponse.json({ error: "Collection job id is required." }, { status: 400 });
  }

  const job = await getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Collection job was not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    progress: job.progress,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  });
}

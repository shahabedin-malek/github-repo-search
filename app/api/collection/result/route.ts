import { NextRequest, NextResponse } from "next/server";
import { getJob, readRepositories } from "@/lib/collection/job-store";

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

  if (job.progress.status !== "completed") {
    return NextResponse.json(
      { error: "Collection is not complete.", progress: job.progress },
      { status: 409 },
    );
  }

  const repositories = await readRepositories(jobId);

  return NextResponse.json({
    ok: true,
    jobId,
    repositories,
    progress: job.progress,
  });
}

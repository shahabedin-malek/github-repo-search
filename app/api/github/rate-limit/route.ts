import {
  NextResponse,
} from "next/server";

const GITHUB_API_URL =
  "https://api.github.com/rate_limit";

const GITHUB_API_VERSION =
  "2026-03-10";

export async function GET() {
  const githubToken =
    process.env.GITHUB_TOKEN;

  if (!githubToken) {
    return NextResponse.json(
      {
        error:
          "GITHUB_TOKEN is not configured.",
      },
      {
        status: 500,
      }
    );
  }

  try {
    const response =
      await fetch(
        GITHUB_API_URL,
        {
          method: "GET",

          headers: {
            Accept:
              "application/vnd.github+json",

            Authorization:
              `Bearer ${githubToken}`,

            "X-GitHub-Api-Version":
              GITHUB_API_VERSION,

            "User-Agent":
              "github-repository-search-tool",
          },

          cache: "no-store",
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.message ||
            "Unable to retrieve GitHub rate limit.",
        },
        {
          status:
            response.status,
        }
      );
    }

    return NextResponse.json({
      search: {
        limit:
          data.resources?.search
            ?.limit ?? null,

        used:
          data.resources?.search
            ?.used ?? null,

        remaining:
          data.resources?.search
            ?.remaining ?? null,

        reset:
          data.resources?.search
            ?.reset ?? null,
      },

      core: {
        limit:
          data.resources?.core
            ?.limit ?? null,

        used:
          data.resources?.core
            ?.used ?? null,

        remaining:
          data.resources?.core
            ?.remaining ?? null,

        reset:
          data.resources?.core
            ?.reset ?? null,
      },
    });
  } catch (error) {
    console.error(
      "Rate limit request failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to connect to GitHub.",
      },
      {
        status: 500,
      }
    );
  }
}
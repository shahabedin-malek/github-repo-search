import {
  NextRequest,
  NextResponse,
} from "next/server";

const GITHUB_API_URL =
  "https://api.github.com/search/repositories";

const GITHUB_API_VERSION =
  "2026-03-10";

const SEARCH_RESULT_LIMIT = 1000;

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  language: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics: string[];
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  homepage: string | null;
  license: {
    key: string;
    name: string;
    spdx_id: string | null;
  } | null;
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
}

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepository[];
}

function getResetTime(
  response: Response
): number | null {
  const resetHeader =
    response.headers.get(
      "x-ratelimit-reset"
    );

  if (!resetHeader) {
    return null;
  }

  const resetTimestamp =
    Number(resetHeader);

  if (
    !Number.isFinite(
      resetTimestamp
    )
  ) {
    return null;
  }

  return resetTimestamp;
}

function getRemainingRateLimit(
  response: Response
): number | null {
  const remainingHeader =
    response.headers.get(
      "x-ratelimit-remaining"
    );

  if (!remainingHeader) {
    return null;
  }

  const remaining =
    Number(remainingHeader);

  if (
    !Number.isFinite(remaining)
  ) {
    return null;
  }

  return remaining;
}

export async function GET(
  request: NextRequest
) {
  const searchParams =
    request.nextUrl.searchParams;

  const query =
    searchParams
      .get("q")
      ?.trim() || "";

  const pageParam =
    searchParams.get("page") || "1";

  const perPageParam =
    searchParams.get(
      "per_page"
    ) || "30";

  if (!query) {
    return NextResponse.json(
      {
        error:
          "Search query is required.",
      },
      {
        status: 400,
      }
    );
  }

  const page =
    Number.parseInt(
      pageParam,
      10
    );

  const perPage =
    Number.parseInt(
      perPageParam,
      10
    );

  if (
    !Number.isInteger(page) ||
    page < 1
  ) {
    return NextResponse.json(
      {
        error:
          "Page must be a positive integer.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !Number.isInteger(perPage) ||
    perPage < 1 ||
    perPage > 100
  ) {
    return NextResponse.json(
      {
        error:
          "per_page must be between 1 and 100.",
      },
      {
        status: 400,
      }
    );
  }

  const requestedStart =
    (page - 1) * perPage;

  if (
    requestedStart >=
    SEARCH_RESULT_LIMIT
  ) {
    return NextResponse.json(
      {
        error:
          "This page is outside the available GitHub search result window.",

        searchLimit:
          SEARCH_RESULT_LIMIT,
      },
      {
        status: 400,
      }
    );
  }

  const remainingResults =
    SEARCH_RESULT_LIMIT -
    requestedStart;

  const githubPerPage =
    Math.min(
      perPage,
      remainingResults
    );

  /*
   * The token is read ONLY on the server.
   *
   * Never expose this value through:
   *
   * NEXT_PUBLIC_GITHUB_TOKEN
   *
   * because NEXT_PUBLIC_* values can
   * become available to browser code.
   */
  const githubToken =
    process.env.GITHUB_TOKEN;

  if (!githubToken) {
    console.error(
      "GITHUB_TOKEN is not configured."
    );

    return NextResponse.json(
      {
        error:
          "GitHub token is not configured. Add GITHUB_TOKEN to .env.local and restart the development server.",
      },
      {
        status: 500,
      }
    );
  }

  try {
    const githubUrl =
      new URL(
        GITHUB_API_URL
      );

    githubUrl.searchParams.set(
      "q",
      query
    );

    githubUrl.searchParams.set(
      "page",
      page.toString()
    );

    githubUrl.searchParams.set(
      "per_page",
      githubPerPage.toString()
    );

    githubUrl.searchParams.set(
      "sort",
      "stars"
    );

    githubUrl.searchParams.set(
      "order",
      "desc"
    );

    const response =
      await fetch(
        githubUrl.toString(),
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

    const remaining =
      getRemainingRateLimit(
        response
      );

    const reset =
      getResetTime(
        response
      );

    /*
     * Rate limit
     */

    if (
      response.status === 403 ||
      response.status === 429
    ) {
      const rateLimitRemaining =
        response.headers.get(
          "x-ratelimit-remaining"
        );

      const retryAfter =
        response.headers.get(
          "retry-after"
        );

      if (
        rateLimitRemaining ===
          "0" ||
        response.status === 429
      ) {
        let message =
          "GitHub API rate limit reached.";

        if (reset) {
          const resetDate =
            new Date(
              reset * 1000
            );

          message += ` Try again after ${resetDate.toLocaleTimeString()}.`;
        } else if (
          retryAfter
        ) {
          const seconds =
            Number(
              retryAfter
            );

          if (
            Number.isFinite(
              seconds
            )
          ) {
            message += ` Try again in approximately ${Math.ceil(
              seconds / 60
            )} minute(s).`;
          }
        }

        return NextResponse.json(
          {
            error: message,

            rateLimit: {
              remaining,
              reset,
            },
          },
          {
            status: 429,
          }
        );
      }

      return NextResponse.json(
        {
          error:
            data?.message ||
            "GitHub rejected the request.",
        },
        {
          status: response.status,
        }
      );
    }

    /*
     * Authentication failure
     */

    if (
      response.status === 401
    ) {
      return NextResponse.json(
        {
          error:
            "GitHub authentication failed. Check that GITHUB_TOKEN is valid.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * Other GitHub errors
     */

    if (!response.ok) {
      console.error(
        "GitHub API error:",
        response.status,
        data
      );

      if (
        response.status === 422
      ) {
        return NextResponse.json(
          {
            error:
              "GitHub rejected the search query. Please check the search syntax.",
          },
          {
            status: 422,
          }
        );
      }

      return NextResponse.json(
        {
          error:
            data?.message ||
            "GitHub API request failed.",
        },
        {
          status:
            response.status,
        }
      );
    }

    const githubData =
      data as GitHubSearchResponse;

    const repositories =
      githubData.items.map(
        (repository) => ({
          id: repository.id,

          name:
            repository.name,

          fullName:
            repository.full_name,

          url:
            repository.html_url,

          description:
            repository.description,

          private:
            repository.private,

          fork:
            repository.fork,

          archived:
            repository.archived,

          language:
            repository.language,

          stars:
            repository.stargazers_count,

          watchers:
            repository.watchers_count,

          forks:
            repository.forks_count,

          openIssues:
            repository.open_issues_count,

          topics:
            repository.topics,

          defaultBranch:
            repository.default_branch,

          createdAt:
            repository.created_at,

          updatedAt:
            repository.updated_at,

          pushedAt:
            repository.pushed_at,

          homepage:
            repository.homepage,

          license:
            repository.license
              ? {
                  key:
                    repository
                      .license
                      .key,

                  name:
                    repository
                      .license
                      .name,

                  spdxId:
                    repository
                      .license
                      .spdx_id,
                }
              : null,

          owner: {
            login:
              repository.owner
                .login,

            avatarUrl:
              repository.owner
                .avatar_url,

            url:
              repository.owner
                .html_url,
          },
        })
      );

    const availableResults =
      Math.min(
        githubData.total_count,
        SEARCH_RESULT_LIMIT
      );

    const totalPages =
      Math.ceil(
        availableResults /
          perPage
      );

    const currentStart =
      requestedStart + 1;

    const currentEnd =
      Math.min(
        requestedStart +
          repositories.length,
        availableResults
      );

    return NextResponse.json({
      query,

      page,

      perPage,

      totalCount:
        githubData.total_count,

      availableResults,

      searchLimit:
        SEARCH_RESULT_LIMIT,

      totalPages,

      currentStart:
        repositories.length > 0
          ? currentStart
          : 0,

      currentEnd,

      incompleteResults:
        githubData.incomplete_results,

      repositories,

      rateLimit: {
        remaining,
        reset,
      },
    });
  } catch (error) {
    console.error(
      "GitHub search request failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to connect to GitHub. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}
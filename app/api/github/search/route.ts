import { NextRequest, NextResponse } from "next/server";

const GITHUB_API_URL = "https://api.github.com/search/repositories";
const GITHUB_API_VERSION = "2026-03-10";

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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const query = searchParams.get("q")?.trim() || "";
  const pageParam = searchParams.get("page") || "1";
  const perPageParam = searchParams.get("per_page") || "30";

  if (!query) {
    return NextResponse.json(
      {
        error: "Search query is required.",
      },
      {
        status: 400,
      }
    );
  }

  const page = Number.parseInt(pageParam, 10);
  const perPage = Number.parseInt(perPageParam, 10);

  if (
    !Number.isInteger(page) ||
    page < 1
  ) {
    return NextResponse.json(
      {
        error: "Page must be a positive integer.",
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
        error: "per_page must be between 1 and 100.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const githubUrl = new URL(GITHUB_API_URL);

    githubUrl.searchParams.set("q", query);
    githubUrl.searchParams.set("page", page.toString());
    githubUrl.searchParams.set("per_page", perPage.toString());
    githubUrl.searchParams.set("sort", "stars");
    githubUrl.searchParams.set("order", "desc");

    const response = await fetch(githubUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": "github-repository-search-tool",
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "GitHub API error:",
        response.status,
        data
      );

      if (response.status === 422) {
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

      if (response.status === 403) {
        return NextResponse.json(
          {
            error:
              "GitHub API rate limit reached. Please try again later.",
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
            "GitHub API request failed.",
        },
        {
          status: response.status,
        }
      );
    }

    const githubData =
      data as GitHubSearchResponse;

    const repositories = githubData.items.map(
      (repository) => ({
        id: repository.id,
        name: repository.name,
        fullName: repository.full_name,
        url: repository.html_url,
        description: repository.description,
        private: repository.private,
        fork: repository.fork,
        archived: repository.archived,
        language: repository.language,
        stars: repository.stargazers_count,
        watchers: repository.watchers_count,
        forks: repository.forks_count,
        openIssues: repository.open_issues_count,
        topics: repository.topics,
        defaultBranch: repository.default_branch,
        createdAt: repository.created_at,
        updatedAt: repository.updated_at,
        pushedAt: repository.pushed_at,
        homepage: repository.homepage,
        license: repository.license
          ? {
              key: repository.license.key,
              name: repository.license.name,
              spdxId: repository.license.spdx_id,
            }
          : null,
        owner: {
          login: repository.owner.login,
          avatarUrl: repository.owner.avatar_url,
          url: repository.owner.html_url,
        },
      })
    );

    return NextResponse.json({
      query,
      page,
      perPage,
      totalCount: githubData.total_count,
      incompleteResults:
        githubData.incomplete_results,
      repositories,
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
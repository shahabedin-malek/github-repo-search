"use client";

import {
  FormEvent,
  useState,
} from "react";

function escapeCsvValue(
  value: unknown
): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  return `"${stringValue.replace(/"/g, '""')}"`;
}

interface Repository {
  id: number;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  language: string | null;
  stars: number;
  watchers: number;
  forks: number;
  openIssues: number;
  topics: string[];
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
  homepage: string | null;
  license: {
    key: string;
    name: string;
    spdxId: string | null;
  } | null;
  owner: {
    login: string;
    avatarUrl: string;
    url: string;
  };
}

interface SearchResponse {
  query: string;
  page: number;
  perPage: number;
  totalCount: number;
  availableResults: number;
  searchLimit: number;
  totalPages: number;
  currentStart: number;
  currentEnd: number;
  incompleteResults: boolean;
  repositories: Repository[];
}

const PER_PAGE_OPTIONS = [
  10,
  30,
  50,
  100,
];

export default function Home() {
  function exportCurrentPageToCsv() {
  if (repositories.length === 0) {
    return;
  }

  const headers = [
    "Repository",
    "Repository URL",
    "Owner",
    "Owner URL",
    "Description",
    "Stars",
    "Forks",
    "Watchers",
    "Open Issues",
    "Language",
    "Topics",
    "Archived",
    "Fork",
    "Private",
    "Default Branch",
    "License",
    "Homepage",
    "Created At",
    "Updated At",
    "Pushed At",
  ];

  const rows = repositories.map(
    (repository) => [
      repository.fullName,
      repository.url,
      repository.owner.login,
      repository.owner.url,
      repository.description ?? "",
      repository.stars,
      repository.forks,
      repository.watchers,
      repository.openIssues,
      repository.language ?? "",
      repository.topics.join(", "),
      repository.archived,
      repository.fork,
      repository.private,
      repository.defaultBranch,
      repository.license?.name ?? "",
      repository.homepage ?? "",
      repository.createdAt,
      repository.updatedAt,
      repository.pushedAt ?? "",
    ]
  );

  const csvRows = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) =>
      row
        .map(escapeCsvValue)
        .join(",")
    ),
  ];

  const csvContent =
    "\uFEFF" +
    csvRows.join("\r\n");

  const blob = new Blob(
    [csvContent],
    {
      type: "text/csv;charset=utf-8;",
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  const safeQuery =
    submittedQuery
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "search";

  link.download =
    `github-repositories-${safeQuery}-page-${currentPage}.csv`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
  const [query, setQuery] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    repositories,
    setRepositories,
  ] = useState<Repository[]>([]);

  const [
    totalCount,
    setTotalCount,
  ] = useState(0);

  const [
    availableResults,
    setAvailableResults,
  ] = useState(0);

  const [
    searchLimit,
    setSearchLimit,
  ] = useState(1000);

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    perPage,
    setPerPage,
  ] = useState(30);

  const [
    totalPages,
    setTotalPages,
  ] = useState(0);

  const [
    currentStart,
    setCurrentStart,
  ] = useState(0);

  const [
    currentEnd,
    setCurrentEnd,
  ] = useState(0);

  const [
    submittedQuery,
    setSubmittedQuery,
  ] = useState("");

  const [
    jumpPage,
    setJumpPage,
  ] = useState("");

const [
  isCollecting,
  setIsCollecting,
] = useState(false);

const [
  collectionProgress,
  setCollectionProgress,
] = useState(0);

const [
  collectedCount,
  setCollectedCount,
] = useState(0);

async function exportAllCollectedToCsv() {
  if (
    !submittedQuery ||
    repositories.length === 0 ||
    isCollecting
  ) {
    return;
  }

  setError("");
  setIsCollecting(true);
  setCollectionProgress(0);
  setCollectedCount(0);

  try {
    const collectionPageSize = 100;

    const maximumResults = Math.min(
      availableResults,
      searchLimit
    );

    const pagesToCollect = Math.ceil(
      maximumResults /
        collectionPageSize
    );

    const allRepositories: Repository[] =
      [];

    for (
      let page = 1;
      page <= pagesToCollect;
      page++
    ) {
      const response =
        await fetch(
          `/api/github/search?q=${encodeURIComponent(
            submittedQuery
          )}&page=${page}&per_page=${collectionPageSize}`
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Unable to collect page ${page}.`
        );
      }

      const searchData =
        data as SearchResponse;

      allRepositories.push(
        ...searchData.repositories
      );

      setCollectedCount(
        allRepositories.length
      );

      setCollectionProgress(
        Math.round(
          (page / pagesToCollect) *
            100
        )
      );
    }

    /*
     * Remove duplicate repositories by
     * GitHub repository ID.
     */
    const uniqueRepositories =
      Array.from(
        new Map(
          allRepositories.map(
            (repository) => [
              repository.id,
              repository,
            ]
          )
        ).values()
      );

    if (
      uniqueRepositories.length === 0
    ) {
      throw new Error(
        "No repositories were collected."
      );
    }

    const headers = [
      "Repository",
      "Repository URL",
      "Owner",
      "Owner URL",
      "Description",
      "Stars",
      "Forks",
      "Watchers",
      "Open Issues",
      "Language",
      "Topics",
      "Archived",
      "Fork",
      "Private",
      "Default Branch",
      "License",
      "Homepage",
      "Created At",
      "Updated At",
      "Pushed At",
    ];

    const rows =
      uniqueRepositories.map(
        (repository) => [
          repository.fullName,
          repository.url,
          repository.owner.login,
          repository.owner.url,
          repository.description ?? "",
          repository.stars,
          repository.forks,
          repository.watchers,
          repository.openIssues,
          repository.language ?? "",
          repository.topics.join(
            ", "
          ),
          repository.archived,
          repository.fork,
          repository.private,
          repository.defaultBranch,
          repository.license?.name ??
            "",
          repository.homepage ?? "",
          repository.createdAt,
          repository.updatedAt,
          repository.pushedAt ?? "",
        ]
      );

    const csvRows = [
      headers
        .map(escapeCsvValue)
        .join(","),

      ...rows.map((row) =>
        row
          .map(escapeCsvValue)
          .join(",")
      ),
    ];

    const csvContent =
      "\uFEFF" +
      csvRows.join("\r\n");

    const blob = new Blob(
      [csvContent],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    const safeQuery =
      submittedQuery
        .trim()
        .replace(
          /[^a-z0-9]+/gi,
          "-"
        )
        .replace(
          /^-+|-+$/g,
          ""
        )
        .toLowerCase() ||
      "search";

    link.download =
      `github-repositories-${safeQuery}-all.csv`;

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(url);

    setCollectedCount(
      uniqueRepositories.length
    );
  } catch (collectionError) {
    console.error(
      "Collection failed:",
      collectionError
    );

    setError(
      collectionError instanceof Error
        ? collectionError.message
        : "Unable to collect all repositories."
    );
  } finally {
    setIsCollecting(false);
  }
}

  async function searchRepositories(
    searchQuery: string,
    page: number,
    resultsPerPage: number
  ) {
    setError("");
    setIsLoading(true);

    try {
      const response =
        await fetch(
          `/api/github/search?q=${encodeURIComponent(
            searchQuery
          )}&page=${page}&per_page=${resultsPerPage}`
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to search GitHub."
        );
      }

      const searchData =
        data as SearchResponse;

      setRepositories(
        searchData.repositories
      );

      setTotalCount(
        searchData.totalCount
      );

      setAvailableResults(
        searchData.availableResults
      );

      setSearchLimit(
        searchData.searchLimit
      );

      setCurrentPage(
        searchData.page
      );

      setPerPage(
        searchData.perPage
      );

      setTotalPages(
        searchData.totalPages
      );

      setCurrentStart(
        searchData.currentStart
      );

      setCurrentEnd(
        searchData.currentEnd
      );

      setSubmittedQuery(
        searchData.query
      );
    } catch (searchError) {
      console.error(
        "Search failed:",
        searchError
      );

      setRepositories([]);

      setError(
        searchError instanceof Error
          ? searchError.message
          : "GitHub API rate limit reached."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedQuery =
      query.trim();

    setError("");

    if (!trimmedQuery) {
      setError(
        "Please enter a search keyword."
      );
      return;
    }

    await searchRepositories(
      trimmedQuery,
      1,
      perPage
    );
  }

  async function handlePageChange(
    page: number
  ) {
    if (
      isLoading ||
      !submittedQuery ||
      page === currentPage ||
      page < 1 ||
      page > totalPages
    ) {
      return;
    }

    await searchRepositories(
      submittedQuery,
      page,
      perPage
    );

    const resultsSection =
  document.querySelector(
    ".results-section"
  );

if (resultsSection) {
  const top =
    resultsSection.getBoundingClientRect()
      .top +
    window.scrollY -
    20;

  window.scrollTo({
    top,
    behavior: "smooth",
  });
}
}

async function handlePerPageChange(
    event: React.ChangeEvent<HTMLSelectElement>
  ) {
    const newPerPage =
      Number(event.target.value);

    if (
      !submittedQuery ||
      !newPerPage
    ) {
      return;
    }

    await searchRepositories(
      submittedQuery,
      1,
      newPerPage
    );
  }

  async function handleJumpToPage(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const page =
      Number.parseInt(
        jumpPage,
        10
      );

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > totalPages
    ) {
      setError(
        `Please enter a page between 1 and ${totalPages}.`
      );

      return;
    }

    setJumpPage("");

    await handlePageChange(page);
  }

  function handleExampleSearch(
    example: string
  ) {
    setQuery(example);
    setError("");
  }

  function formatNumber(
    number: number
  ) {
    return new Intl.NumberFormat(
      "en-US"
    ).format(number);
  }

  function formatCompactNumber(
    number: number
  ) {
    return new Intl.NumberFormat(
      "en-US",
      {
        notation: "compact",
        maximumFractionDigits: 1,
      }
    ).format(number);
  }

  function getPageNumbers() {
    if (totalPages <= 1) {
      return [];
    }

    const pages: (
      | number
      | "ellipsis"
    )[] = [];

    if (totalPages <= 7) {
      for (
        let page = 1;
        page <= totalPages;
        page++
      ) {
        pages.push(page);
      }

      return pages;
    }

    pages.push(1);

    if (currentPage > 4) {
      pages.push("ellipsis");
    }

    const startPage =
      Math.max(
        2,
        currentPage - 2
      );

    const endPage =
      Math.min(
        totalPages - 1,
        currentPage + 2
      );

    for (
      let page = startPage;
      page <= endPage;
      page++
    ) {
      pages.push(page);
    }

    if (
      currentPage <
      totalPages - 3
    ) {
      pages.push("ellipsis");
    }

    pages.push(totalPages);

    return pages;
  }

  return (
    <main className="app-shell">
      {/* =========================
          HERO
      ========================= */}

      <section className="hero">
        <div className="hero-badge">
          GitHub Repository Research Tool
        </div>

        <h1>
          Search
          <span>
            {" "}
            GitHub repositories.
          </span>
        </h1>

        <p className="hero-description">
          Search GitHub repositories by
          keyword and explore the results
          for further research and
          analysis.
        </p>

        {/* =========================
            SEARCH FORM
        ========================= */}

        <form
          className="search-form"
          onSubmit={handleSearch}
          noValidate
        >
          <div className="search-input-wrapper">
            <svg
              className="search-icon"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(
                  event.target.value
                );
                setError("");
              }}
              placeholder="Search repositories..."
              aria-label="Search GitHub repositories"
              aria-invalid={Boolean(
                error
              )}
              aria-describedby={
                error
                  ? "search-error"
                  : undefined
              }
              disabled={isLoading}
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner" />
                Searching...
              </>
            ) : (
              "Search"
            )}
          </button>
        </form>

        {/* =========================
            ERROR
        ========================= */}

        {error && (
          <div
            id="search-error"
            className="search-error"
            role="alert"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2"
              />

              <path
                d="M12 8V12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />

              <circle
                cx="12"
                cy="16"
                r="1"
                fill="currentColor"
              />
            </svg>

            <span>{error}</span>
          </div>
        )}

        {/* =========================
            EXAMPLES
        ========================= */}

        <div className="example-searches">
          <span>Try:</span>

          <button
            type="button"
            onClick={() =>
              handleExampleSearch(
                "ai agent"
              )
            }
            disabled={isLoading}
          >
            ai agent
          </button>

          <button
            type="button"
            onClick={() =>
              handleExampleSearch(
                "nextjs"
              )
            }
            disabled={isLoading}
          >
            nextjs
          </button>

          <button
            type="button"
            onClick={() =>
              handleExampleSearch(
                "python"
              )
            }
            disabled={isLoading}
          >
            python
          </button>

          <button
            type="button"
            onClick={() =>
              handleExampleSearch(
                "web scraper"
              )
            }
            disabled={isLoading}
          >
            web scraper
          </button>
        </div>
      </section>

      {/* =========================
          RESULTS
      ========================= */}

      <section className="results-section">
        <div className="section-header">
          <div>
            <h2>
              Repository results
            </h2>

            <p>
              {submittedQuery
                ? `${formatNumber(
                    totalCount
                  )} repositories found for "${submittedQuery}"`
                : "Search results will appear here."}
            </p>
          </div>

<div className="export-actions">
{isCollecting && (
  <div className="collection-progress">
    <div className="collection-progress-text">
      <span>
        Collecting repositories...
      </span>

      <strong>
        {collectedCount}
      </strong>
    </div>

    <div className="collection-progress-track">
      <div
        className="collection-progress-bar"
        style={{
          width: `${collectionProgress}%`,
        }}
      />
    </div>
  </div>
)}
  <button
    type="button"
    className="export-button"
    onClick={exportCurrentPageToCsv}
    disabled={repositories.length === 0}
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 3V15M12 15L7 10M12 15L17 10M5 21H19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>

    Export current page
  </button>

  <button
  type="button"
  className="export-all-button"
  onClick={exportAllCollectedToCsv}
  disabled={
    repositories.length === 0 ||
    isCollecting
  }
  title="Collect all available search results and export them as CSV"
>
  {isCollecting ? (
    <>
      Collecting {collectionProgress}%
    </>
  ) : (
    <>
      Export all collected
    </>
  )}
</button>
</div>

        </div>

        {submittedQuery &&
          !isLoading &&
          repositories.length >
            0 && (
            <div className="pagination-summary">
              <div>
                <strong>
                  Showing{" "}
                  {formatNumber(
                    currentStart
                  )}
                  –
                  {formatNumber(
                    currentEnd
                  )}
                </strong>

                <span>
                  {" "}
                  of{" "}
                  {formatNumber(
                    availableResults
                  )}{" "}
                  available search
                  results
                </span>
              </div>

              <label className="per-page-control">
                <span>
                  Results per page
                </span>

                <select
                  value={perPage}
                  onChange={
                    handlePerPageChange
                  }
                  disabled={isLoading}
                  aria-label="Results per page"
                >
                  {PER_PAGE_OPTIONS.map(
                    (option) => (
                      <option
                        key={option}
                        value={option}
                      >
                        {option}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>
          )}

        {submittedQuery &&
          totalCount >
            searchLimit && (
            <div className="search-limit-notice">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />

                <path
                  d="M12 8V12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />

                <circle
                  cx="12"
                  cy="16"
                  r="1"
                  fill="currentColor"
                />
              </svg>

              <span>
                GitHub reports{" "}
                <strong>
                  {formatNumber(
                    totalCount
                  )}
                </strong>{" "}
                matches, but this search
                interface can page through
                the first{" "}
                <strong>
                  {formatNumber(
                    searchLimit
                  )}
                </strong>{" "}
                results for this query.
              </span>
            </div>
          )}

        {isLoading ? (
          <div className="loading-state">
            <span className="large-spinner" />

            <h3>
              Searching GitHub...
            </h3>

            <p>
              Loading repository
              results.
            </p>
          </div>
        ) : repositories.length ===
          0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M12 3V15M12 15L7 10M12 15L17 10M5 21H19"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h3>
              No repositories yet
            </h3>

            <p>
              Enter a keyword above to
              search GitHub repositories.
            </p>
          </div>
        ) : (
          <>
            {/* =========================
                TABLE
            ========================= */}

            <div className="repository-table-wrapper">
              <table className="repository-table">
                <thead>
                  <tr>
                    <th>
                      Repository
                    </th>

                    <th>
                      Stars
                    </th>

                    <th>
                      Forks
                    </th>

                    <th>
                      Language
                    </th>

                    <th>
                      Issues
                    </th>

                    <th>
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {repositories.map(
                    (repository) => (
                      <tr
                        key={
                          repository.id
                        }
                      >
                        <td className="repository-main-cell">
                          <div className="repository-info">
                            <img
                              src={
                                repository
                                  .owner
                                  .avatarUrl
                              }
                              alt={`${repository.owner.login} avatar`}
                              className="owner-avatar"
                              width={40}
                              height={40}
                            />

                            <div className="repository-content">
                              <a
                                href={
                                  repository.url
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="repository-name"
                              >
                                {
                                  repository.fullName
                                }
                              </a>

                              {repository.description && (
                                <p className="repository-description">
                                  {
                                    repository.description
                                  }
                                </p>
                              )}

                              <div className="repository-meta">
                                {repository.topics
                                  .slice(
                                    0,
                                    5
                                  )
                                  .map(
                                    (
                                      topic
                                    ) => (
                                      <span
                                        key={
                                          topic
                                        }
                                        className="topic-tag"
                                      >
                                        {
                                          topic
                                        }
                                      </span>
                                    )
                                  )}

                                {repository.fork && (
                                  <span className="status-tag">
                                    Fork
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="metric">
                            <span className="metric-icon">
                              ★
                            </span>

                            {formatCompactNumber(
                              repository.stars
                            )}
                          </span>
                        </td>

                        <td>
                          <span className="metric">
                            <span className="metric-icon">
                              ⑂
                            </span>

                            {formatCompactNumber(
                              repository.forks
                            )}
                          </span>
                        </td>

                        <td>
                          {repository.language ? (
                            <span className="language">
                              <span className="language-dot" />

                              {
                                repository.language
                              }
                            </span>
                          ) : (
                            <span className="muted">
                              —
                            </span>
                          )}
                        </td>

                        <td>
                          <span className="issues-count">
                            {formatCompactNumber(
                              repository.openIssues
                            )}
                          </span>
                        </td>

                        <td>
                          {repository.archived ? (
                            <span className="archived-tag">
                              Archived
                            </span>
                          ) : (
                            <span className="active-tag">
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* =========================
                PAGINATION
            ========================= */}

            {totalPages > 1 && (
              <div className="pagination-container">
                <button
                  type="button"
                  className="pagination-arrow"
                  onClick={() =>
                    handlePageChange(
                      currentPage - 1
                    )
                  }
                  disabled={
                    isLoading ||
                    currentPage === 1
                  }
                  aria-label="Previous page"
                >
                  ←
                  <span>
                    Previous
                  </span>
                </button>

                <div className="pagination-pages">
                  {getPageNumbers().map(
                    (page, index) => {
                      if (
                        page ===
                        "ellipsis"
                      ) {
                        return (
                          <span
                            key={`ellipsis-${index}`}
                            className="pagination-ellipsis"
                          >
                            …
                          </span>
                        );
                      }

                      return (
                        <button
                          key={page}
                          type="button"
                          className={`pagination-page ${
                            page ===
                            currentPage
                              ? "active"
                              : ""
                          }`}
                          onClick={() =>
                            handlePageChange(
                              page
                            )
                          }
                          disabled={
                            isLoading
                          }
                          aria-current={
                            page ===
                            currentPage
                              ? "page"
                              : undefined
                          }
                        >
                          {page}
                        </button>
                      );
                    }
                  )}
                </div>

                <button
                  type="button"
                  className="pagination-arrow"
                  onClick={() =>
                    handlePageChange(
                      currentPage + 1
                    )
                  }
                  disabled={
                    isLoading ||
                    currentPage ===
                      totalPages
                  }
                  aria-label="Next page"
                >
                  <span>
                    Next
                  </span>
                  →
                </button>
              </div>
            )}

            {/* =========================
                JUMP TO PAGE
            ========================= */}

            {totalPages > 7 && (
              <form
                className="jump-page-form"
                onSubmit={
                  handleJumpToPage
                }
              >
                <span>
                  Jump to page
                </span>

                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={jumpPage}
                  onChange={(event) =>
                    setJumpPage(
                      event.target.value
                    )
                  }
                  placeholder="Page"
                  aria-label="Page number"
                  disabled={isLoading}
                />

                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    !jumpPage
                  }
                >
                  Go
                </button>
              </form>
            )}
          </>
        )}
      </section>

      {/* =========================
          FOOTER
      ========================= */}

      <footer className="footer">
        <p>
          GitHub Repository Search Tool ·
          v0.1
        </p>
      </footer>
    </main>
  );
}
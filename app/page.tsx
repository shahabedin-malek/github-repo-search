"use client";

import { FormEvent, useState } from "react";

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
  incompleteResults: boolean;
  repositories: Repository[];
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [repositories, setRepositories] = useState<
    Repository[]
  >([]);

  const [totalCount, setTotalCount] = useState(0);

  const [submittedQuery, setSubmittedQuery] =
    useState("");

  async function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedQuery = query.trim();

    setError("");

    if (!trimmedQuery) {
      setError(
        "Please enter a search keyword."
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/github/search?q=${encodeURIComponent(
          trimmedQuery
        )}&page=1&per_page=30`
      );

      const data = await response.json();

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

      setSubmittedQuery(
        searchData.query
      );
    } catch (searchError) {
      console.error(
        "Search failed:",
        searchError
      );

      setRepositories([]);
      setTotalCount(0);

      setError(
        searchError instanceof Error
          ? searchError.message
          : "Something went wrong while searching GitHub."
      );
    } finally {
      setIsLoading(false);
    }
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
          <span> GitHub repositories.</span>
        </h1>

        <p className="hero-description">
          Search GitHub repositories by keyword
          and explore the results for further
          research and analysis.
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
                setQuery(event.target.value);
                setError("");
              }}
              placeholder="Search repositories..."
              aria-label="Search GitHub repositories"
              aria-invalid={Boolean(error)}
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
              handleExampleSearch("ai agent")
            }
            disabled={isLoading}
          >
            ai agent
          </button>

          <button
            type="button"
            onClick={() =>
              handleExampleSearch("nextjs")
            }
            disabled={isLoading}
          >
            nextjs
          </button>

          <button
            type="button"
            onClick={() =>
              handleExampleSearch("python")
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

          <button
            type="button"
            className="export-button"
            disabled={
              repositories.length === 0
            }
          >
            Export CSV
          </button>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <span className="large-spinner" />

            <h3>
              Searching GitHub...
            </h3>

            <p>
              Finding repositories matching
              your search.
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
                      {/* Repository */}

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

                      {/* Stars */}

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

                      {/* Forks */}

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

                      {/* Language */}

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

                      {/* Issues */}

                      <td>
                        <span className="issues-count">
                          {formatCompactNumber(
                            repository.openIssues
                          )}
                        </span>
                      </td>

                      {/* Status */}

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
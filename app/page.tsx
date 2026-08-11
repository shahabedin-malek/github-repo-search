"use client";

import { FormEvent, useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();

    setError("");

    if (!trimmedQuery) {
      setError("Please enter a search keyword.");
      return;
    }

    setIsLoading(true);

    // GitHub API will be connected in Phase 3.
    // This small delay gives us a real loading state to work with.
    await new Promise((resolve) => setTimeout(resolve, 500));

    setSubmittedQuery(trimmedQuery);
    setIsLoading(false);
  }

  function handleExampleSearch(example: string) {
    setQuery(example);
    setError("");
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
          Search GitHub repositories by keyword and export the results
          for further research and analysis.
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
              aria-describedby={error ? "search-error" : undefined}
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
            EXAMPLE SEARCHES
        ========================= */}

        <div className="example-searches">
          <span>Try:</span>

          <button
            type="button"
            onClick={() => handleExampleSearch("ai agent")}
            disabled={isLoading}
          >
            ai agent
          </button>

          <button
            type="button"
            onClick={() => handleExampleSearch("nextjs")}
            disabled={isLoading}
          >
            nextjs
          </button>

          <button
            type="button"
            onClick={() => handleExampleSearch("python")}
            disabled={isLoading}
          >
            python
          </button>

          <button
            type="button"
            onClick={() => handleExampleSearch("web scraper")}
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
            <h2>Repository results</h2>

            <p>
              {submittedQuery
                ? `Search prepared for "${submittedQuery}"`
                : "Search results will appear here."}
            </p>
          </div>

          <button
            type="button"
            className="export-button"
            disabled
          >
            Export CSV
          </button>
        </div>

        {!submittedQuery ? (
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

            <h3>No repositories yet</h3>

            <p>
              Enter a keyword above to search GitHub repositories.
            </p>
          </div>
        ) : (
          <div className="search-ready-state">
            <div className="search-ready-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />

                <path
                  d="M16.5 16.5L21 21"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <h3>
              Ready to search GitHub
            </h3>

            <p>
              Your search for{" "}
              <strong>&quot;{submittedQuery}&quot;</strong>{" "}
              is ready.
            </p>

            <span className="phase-note">
              GitHub API integration is coming in Phase 3.
            </span>
          </div>
        )}
      </section>

      {/* =========================
          FOOTER
      ========================= */}

      <footer className="footer">
        <p>
          GitHub Repository Search Tool · v0.1
        </p>
      </footer>
    </main>
  );
}
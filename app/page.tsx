"use client";

import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    console.log("Search:", query);
  }

  return (
    <main className="app-shell">
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

        <form className="search-form" onSubmit={handleSearch}>
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
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search repositories..."
              aria-label="Search GitHub repositories"
            />
          </div>

          <button type="submit">
            Search
          </button>
        </form>

        <div className="example-searches">
          <span>Try:</span>

          <button
            type="button"
            onClick={() => setQuery("ai agent")}
          >
            ai agent
          </button>

          <button
            type="button"
            onClick={() => setQuery("nextjs")}
          >
            nextjs
          </button>

          <button
            type="button"
            onClick={() => setQuery("python")}
          >
            python
          </button>

          <button
            type="button"
            onClick={() => setQuery("web scraper")}
          >
            web scraper
          </button>
        </div>
      </section>

      <section className="results-section">
        <div className="section-header">
          <div>
            <h2>Repository results</h2>
            <p>
              Search results will appear here.
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
      </section>

      <footer className="footer">
        <p>
          GitHub Repository Search Tool · v0.1
        </p>
      </footer>
    </main>
  );
}
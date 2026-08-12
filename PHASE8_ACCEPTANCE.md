# v0.2 — Phase 8 Acceptance Test

## Purpose

Phase 8 is the release gate for v0.2.

It verifies the complete collection pipeline:

```text
Advanced Search
      ↓
Query Partitioning
      ↓
Large-Scale Collection
      ↓
Server-Side Progress
      ↓
Deduplication
      ↓
Large CSV
      ↓
Failure / Resume controls
```

## Acceptance matrix

| Requirement | Status |
|---|---|
| Advanced search filters | Implemented |
| Query partitioning | Implemented |
| Up to 9,999-result collection design | Implemented |
| Server-side progress | Implemented |
| Deduplication | Implemented |
| Large CSV generation | Implemented |
| Existing v0.1 search | Regression test required |
| Existing v0.1 pagination | Regression test required |
| Existing v0.1 CSV export | Regression test required |
| GitHub token server-side | Implemented |
| Error handling | Implemented |
| Retry behavior | Implemented |
| Cancellation | Implemented |
| Resume behavior | Implemented |
| End-to-end test | Run required |

## Automated smoke test

Start the application:

```powershell
npm run dev
```

Then, in a second PowerShell window:

```powershell
Set-Location D:\docker\github-repo-search

.\scripts\phase8-smoke-test.ps1
```

Or use a different query:

```powershell
.\scripts\phase8-smoke-test.ps1 -Query "nextjs" -MaxResults 50
```

The smoke test verifies:

1. Collection job creation.
2. Server-side job status.
3. Partition execution.
4. Pagination.
5. Result count.
6. Server-side collection result.
7. Duplicate counter.
8. CSV endpoint.
9. v0.1 CSV header compatibility.

## Manual acceptance tests

### A. Existing v0.1 search

Use the normal search box.

Expected:

```text
Search → results → table → pagination
```

Must continue working.

### B. Existing CSV export

Run a normal search and export the current page.

Expected:

- CSV downloads.
- Existing columns remain present.
- CSV opens correctly in Excel/LibreOffice/Google Sheets.

### C. Advanced filters

Search with combinations such as:

```text
docker
language:Python
stars:>=100
archived:false
```

Expected: filters are reflected in the GitHub query and results.

### D. Partitioning

Start a collection with language partitions.

Expected:

```text
Partition 1
Partition 2
Partition 3
```

Each partition retains the original search qualifiers.

### E. Progress

During collection verify:

- current partition
- current page
- records collected
- total partitions
- percentage
- status

Progress must come from the server job state.

### F. Deduplication

Use partitions likely to overlap.

Expected:

```text
raw records > unique records
```

and:

```text
duplicatesSkipped > 0
```

when duplicates actually occur.

### G. Cancellation

Start collection and cancel it.

Expected:

```text
status = cancelled
```

Already collected records remain available.

### H. Resume

Resume the cancelled job.

Expected:

- same job ID
- previously collected records preserved
- collection continues from the saved checkpoint
- no restart from page 1
- no duplicate final records

### I. Forced failure

Temporarily make the GitHub token invalid in the local environment.

Expected:

```text
running → failed
```

The job should retain:

- error
- partition
- page
- records already collected

Restore the valid token.

### J. Retry

Retry the failed job.

Expected:

```text
failed → pending → running → completed
```

without discarding successfully collected data.

### K. Large collection

Run progressively:

```text
100
500
1,000
5,000
9,999
```

Do not start with 9,999.

Verify memory usage, runtime, API rate limits, CSV size, and stability at each level.

## Release decision

v0.2 should only be labeled **STABLE** after the following are all confirmed:

```text
[ ] Smoke test passes
[ ] v0.1 regression test passes
[ ] Filters pass
[ ] Partitioning passes
[ ] Deduplication passes
[ ] Progress passes
[ ] CSV passes
[ ] Cancellation passes
[ ] Resume passes
[ ] Forced failure/retry passes
[ ] Large collection test passes
[ ] No TypeScript/build errors
```

## Production caveat

The current collection job store uses local `.data/collection-jobs` storage.

That is suitable for local development, but it should not be considered a durable multi-instance Vercel production job backend.

Before production deployment of long-running/resumable collection, replace the local job store with persistent shared storage/database.

That does not block the local v0.2 acceptance test, but it should remain an explicit deployment requirement.

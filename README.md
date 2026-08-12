# v0.2 Phase 5 — Deduplication

Phase 5 adds global repository deduplication to the Phase 4 server-side collection job.

## Why

Phase 2 can split a broad GitHub query into multiple partitions. The same repository can therefore be returned by more than one partition. Phase 5 guarantees that the final collection contains one record per repository identity.

## Identity

The primary identity is the GitHub numeric repository `id`:

```text
id:12345678
```

A defensive `fullName` fallback is used only when the id is not finite:

```text
fullName:owner/repository
```

## Server-side behavior

Every collection page is passed through:

```text
GitHub page
    ↓
appendUniqueRepositories()
    ↓
repository identity index
    ↓
new records only
    ↓
records.jsonl
```

The job now records:

- `rawRecordsFetched` — every repository returned by GitHub
- `recordsCollected` — unique repositories actually stored
- `duplicatesSkipped` — records discarded because they were already seen

## Files

- `lib/collection/job-store.ts` — persistent repository identity index and unique append operation
- `lib/collection/job-worker.ts` — integrates deduplication into every collection step
- `lib/collection/dedupe.ts` — pure/testable deduplication helper
- `lib/collection/types.ts` — Phase 5 progress fields

## Storage

Each job now contains:

```text
.data/collection-jobs/<jobId>/
├── job.json
├── records.jsonl
└── repository-index.json
```

The index prevents the collector from scanning the entire records file on every page.

## Scope boundary

This phase does not redesign CSV generation. Phase 6 owns large CSV generation.

This local file-backed index is intended for the current development architecture. Concurrency locking, durable multi-instance storage, and resume/retry semantics remain Phase 7 concerns.

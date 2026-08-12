# Phase 7 — Failure / Resume Testing

Phase 7 verifies that a collection can be safely interrupted and continued
without losing already committed records or resetting the partition/page cursor.

## New endpoints

```text
POST /api/collection/cancel
POST /api/collection/resume
POST /api/collection/retry
```

All three accept:

```json
{
  "jobId": "job-..."
}
```

## Expected behavior

### 1. Normal collection

```text
pending → running → completed
```

### 2. Failure

If a GitHub request fails:

```text
running → failed
```

The failed job retains:

- current partition
- current page
- records already written
- repository identity index
- duplicate count
- retry count
- failure timestamp
- error message

No successful page is rolled back.

### 3. Retry

```text
failed
  ↓
POST /api/collection/retry
  ↓
pending
  ↓
POST /api/collection/step
```

The same saved partition/page is attempted again.

### 4. Cancellation

```text
running
  ↓
POST /api/collection/cancel
  ↓
cancelled
```

Already collected data remains on disk.

### 5. Resume

```text
cancelled
  ↓
POST /api/collection/resume
  ↓
pending
  ↓
POST /api/collection/step
```

The collector continues from its saved cursor.

## Manual test checklist

1. Start a collection with a small target such as 200.
2. Confirm the job reaches `running`.
3. Cancel it.
4. Check `/api/collection/status?id=<jobId>`.
5. Verify status is `cancelled` and `recordsCollected` is unchanged.
6. Resume it.
7. Call `/api/collection/step` repeatedly.
8. Verify it continues from the saved page.
9. Complete the collection.
10. Inspect the result.
11. Force a GitHub failure by temporarily using an invalid token.
12. Verify the job becomes `failed`.
13. Restore the token.
14. Retry the job.
15. Verify the saved cursor is reused and collection completes.

## Safety property

The persisted record file is append-only and the repository identity index is
updated together with each committed page. A page that fails before its
records are committed is retried; a page that has already been committed is
not replayed by the cursor.

## Important deployment note

The current `.data/collection-jobs` store is appropriate for local
development and a single persistent server process. It is not a durable
multi-instance Vercel job store. Before deploying long-running/resumable
collection to Vercel production, Phase 7/8 should use a persistent database
or durable object/storage layer.

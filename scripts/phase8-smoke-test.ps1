param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Query = "docker",
  [int]$MaxResults = 20
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== GitHub Repository Search - v0.2 Acceptance Smoke Test ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl"
Write-Host "Query:    $Query"
Write-Host "Target:   $MaxResults"
Write-Host ""

function Invoke-JsonPost {
  param(
    [string]$Url,
    [hashtable]$Body
  )

  $json = $Body | ConvertTo-Json -Depth 20

  return Invoke-RestMethod -Method Post -Uri $Url -ContentType "application/json" -Body $json
}

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw "FAIL: $Message"
  }

  Write-Host "PASS: $Message" -ForegroundColor Green
}

Write-Host "Starting collection..."

$startBody = @{
  query = $Query
  partitionOptions = @{
    strategy = "language"
    languages = @("Python", "JavaScript", "TypeScript")
    maxPartitions = 3
  }
  collectionOptions = @{
    maxResults = $MaxResults
    maxResultsPerPartition = 100
    perPage = 10
    maxPagesPerPartition = 10
  }
}

$start = Invoke-JsonPost "$BaseUrl/api/collection/start" $startBody

Assert-True ($start.ok -eq $true) "collection job can be created"
Assert-True (-not [string]::IsNullOrWhiteSpace($start.job.id)) "job id is returned"

$jobId = $start.job.id

Write-Host "Job ID: $jobId"

for ($i = 0; $i -lt 30; $i++) {

  $step = Invoke-JsonPost "$BaseUrl/api/collection/step" @{
    jobId = $jobId
  }

  $status = $step.job.progress.status
  $count = $step.job.progress.recordsCollected
  $percent = $step.job.progress.percent

  Write-Host ("Step {0}: status={1}, records={2}, progress={3}%" -f ($i + 1), $status, $count, $percent)

  if ($status -eq "completed") {
    break
  }

  if ($status -eq "failed") {
    throw "Collection failed: $($step.job.progress.error)"
  }

  Start-Sleep -Milliseconds 250
}

$statusResponse = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/collection/status?id=$jobId"

Assert-True ($statusResponse.ok -eq $true) "server-side job status is readable"

$status = $statusResponse.progress.status

Assert-True ($status -eq "completed") "normal collection reaches completed state"

$records = [int]$statusResponse.progress.recordsCollected

Assert-True ($records -gt 0) "collection returned at least one repository"

Assert-True ($records -le $MaxResults) "collection respects maxResults"

$result = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/collection/result?id=$jobId"

Assert-True ($result.ok -eq $true) "collection result endpoint works"

Assert-True ($result.repositories.Count -eq $records) "result count matches server progress"

Assert-True ($null -ne $statusResponse.progress.duplicatesSkipped) "duplicate counter exists"

$csvBody = @{
  repositories = $result.repositories
}

$csvJson = $csvBody | ConvertTo-Json -Depth 20

$csvResponse = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$BaseUrl/api/collection/csv" -ContentType "application/json" -Body $csvJson

Assert-True ($csvResponse.StatusCode -eq 200) "CSV endpoint returns HTTP 200"

Assert-True ($csvResponse.Headers["Content-Type"] -like "text/csv*") "CSV endpoint returns text/csv"

$csv = $csvResponse.Content

Assert-True ($csv.StartsWith('"Repository","Owner","Description"')) "CSV preserves v0.1 schema"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "NORMAL COLLECTION SMOKE TEST PASSED" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

Write-Host "Manual tests still required:" -ForegroundColor Yellow
Write-Host "  - cancellation"
Write-Host "  - resume after cancellation"
Write-Host "  - forced GitHub/API failure"
Write-Host "  - retry after failure"
Write-Host "  - deduplication across partitions"
Write-Host "  - full 9,999-result run"
Write-Host "  - existing v0.1 UI search/pagination/export regression"
Write-Host "  - Vercel deployment behavior"

/**
 * Phase 2 — Query Partitioning Engine
 *
 * This module ONLY creates partition plans.
 * It does not call GitHub and does not collect repositories.
 *
 * Phase 3 will consume the PartitionPlan and execute its partitions.
 */

import type {
  DatePartitionField,
  PartitionOptions,
  PartitionPlan,
  PartitionStrategy,
  QueryPartition,
} from "./types";

export const DEFAULT_LANGUAGES = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Go",
  "Java",
  "Rust",
  "C++",
  "C#",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "Dart",
  "Shell",
];

const DEFAULT_MONTHS_PER_PARTITION = 12;
const DEFAULT_MAX_PARTITIONS = 100;

function createPlanId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createPartitionId(index: number): string {
  return `partition-${String(index + 1).padStart(4, "0")}`;
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

function quoteQualifierValue(value: string): string {
  return /\s/.test(value)
    ? `"${value.replace(/"/g, '\\"')}"`
    : value;
}

function appendQualifier(query: string, qualifier: string): string {
  const normalized = normalizeQuery(query);
  return normalized ? `${normalized} ${qualifier}` : qualifier;
}

function validateDate(value: string, fieldName: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${fieldName} is not a valid calendar date.`);
  }
}

function dateToUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function normalizeLanguages(languages: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const language of languages) {
    const normalized = language.trim();

    if (!normalized) continue;

    const key = normalized.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }

  return result;
}

function buildLanguagePartitions(
  originalQuery: string,
  languages: string[],
  maxPartitions: number,
): QueryPartition[] {
  return languages.slice(0, maxPartitions).map((language, index) => ({
    id: createPartitionId(index),
    query: appendQualifier(
      originalQuery,
      `language:${quoteQualifierValue(language)}`,
    ),
    strategy: "language",
    label: `Language: ${language}`,
    status: "pending",
    index,
    language,
  }));
}

function buildDatePartitions(
  originalQuery: string,
  field: DatePartitionField,
  from: string,
  to: string,
  monthsPerPartition: number,
  maxPartitions: number,
): QueryPartition[] {
  const partitions: QueryPartition[] = [];
  let cursor = dateToUtcDate(from);
  const end = dateToUtcDate(to);

  while (cursor <= end && partitions.length < maxPartitions) {
    const nextBoundary = addMonths(cursor, monthsPerPartition);
    const partitionEnd = addDays(nextBoundary, -1);
    const actualEnd = partitionEnd < end ? partitionEnd : end;

    const rangeFrom = formatDate(cursor);
    const rangeTo = formatDate(actualEnd);
    const index = partitions.length;

    partitions.push({
      id: createPartitionId(index),
      query: appendQualifier(
        originalQuery,
        `${field}:${rangeFrom}..${rangeTo}`,
      ),
      strategy: "date",
      label: `${field}: ${rangeFrom} → ${rangeTo}`,
      status: "pending",
      index,
      dateRange: {
        field,
        from: rangeFrom,
        to: rangeTo,
      },
    });

    cursor = addDays(actualEnd, 1);
  }

  return partitions;
}

function chooseStrategy(
  options: PartitionOptions,
): Exclude<PartitionStrategy, "none"> {
  if (options.strategy && options.strategy !== "none") {
    return options.strategy;
  }

  if (options.dateFrom || options.dateTo) {
    return "date";
  }

  return "language";
}

function buildHybridPartitions(
  originalQuery: string,
  options: PartitionOptions,
  maxPartitions: number,
): QueryPartition[] {
  const languages = normalizeLanguages(
    options.languages?.length ? options.languages : DEFAULT_LANGUAGES,
  );

  if (!options.dateFrom || !options.dateTo) {
    throw new Error(
      "Hybrid partitioning requires both dateFrom and dateTo.",
    );
  }

  validateDate(options.dateFrom, "dateFrom");
  validateDate(options.dateTo, "dateTo");

  if (dateToUtcDate(options.dateFrom) > dateToUtcDate(options.dateTo)) {
    throw new Error("dateFrom must be earlier than or equal to dateTo.");
  }

  const monthsPerPartition =
    options.monthsPerPartition ?? DEFAULT_MONTHS_PER_PARTITION;

  if (!Number.isInteger(monthsPerPartition) || monthsPerPartition < 1) {
    throw new Error("monthsPerPartition must be a positive integer.");
  }

  const datePartitions = buildDatePartitions(
    "",
    options.dateField ?? "pushed",
    options.dateFrom,
    options.dateTo,
    monthsPerPartition,
    maxPartitions,
  );

  const partitions: QueryPartition[] = [];

  for (const datePartition of datePartitions) {
    for (const language of languages) {
      if (partitions.length >= maxPartitions) {
        return partitions;
      }

      const index = partitions.length;
      const range = datePartition.dateRange!;

      partitions.push({
        id: createPartitionId(index),
        query: appendQualifier(
          appendQualifier(
            originalQuery,
            `language:${quoteQualifierValue(language)}`,
          ),
          `${range.field}:${range.from}..${range.to}`,
        ),
        strategy: "hybrid",
        label: `${language} • ${range.from} → ${range.to}`,
        status: "pending",
        index,
        language,
        dateRange: range,
      });
    }
  }

  return partitions;
}

/**
 * Creates a partition plan.
 *
 * This function does not make network requests.
 */
export function createPartitionPlan(
  query: string,
  options: PartitionOptions = {},
): PartitionPlan {
  const originalQuery = normalizeQuery(query);

  if (!originalQuery) {
    throw new Error("A search query is required.");
  }

  const maxPartitions =
    options.maxPartitions ?? DEFAULT_MAX_PARTITIONS;

  if (!Number.isInteger(maxPartitions) || maxPartitions < 1) {
    throw new Error("maxPartitions must be a positive integer.");
  }

  const strategy = chooseStrategy(options);

  let partitions: QueryPartition[];

  if (strategy === "language") {
    const languages = normalizeLanguages(
      options.languages?.length
        ? options.languages
        : DEFAULT_LANGUAGES,
    );

    if (languages.length === 0) {
      throw new Error(
        "At least one language is required for language partitioning.",
      );
    }

    partitions = buildLanguagePartitions(
      originalQuery,
      languages,
      maxPartitions,
    );
  } else if (strategy === "date") {
    if (!options.dateFrom || !options.dateTo) {
      throw new Error(
        "Date partitioning requires both dateFrom and dateTo.",
      );
    }

    validateDate(options.dateFrom, "dateFrom");
    validateDate(options.dateTo, "dateTo");

    if (dateToUtcDate(options.dateFrom) > dateToUtcDate(options.dateTo)) {
      throw new Error(
        "dateFrom must be earlier than or equal to dateTo.",
      );
    }

    const monthsPerPartition =
      options.monthsPerPartition ?? DEFAULT_MONTHS_PER_PARTITION;

    if (
      !Number.isInteger(monthsPerPartition) ||
      monthsPerPartition < 1
    ) {
      throw new Error("monthsPerPartition must be a positive integer.");
    }

    partitions = buildDatePartitions(
      originalQuery,
      options.dateField ?? "pushed",
      options.dateFrom,
      options.dateTo,
      monthsPerPartition,
      maxPartitions,
    );
  } else if (strategy === "hybrid") {
    partitions = buildHybridPartitions(
      originalQuery,
      options,
      maxPartitions,
    );
  } else {
    throw new Error(`Unsupported partition strategy: ${strategy}`);
  }

  if (partitions.length === 0) {
    throw new Error("The partition plan contains no partitions.");
  }

  return {
    id: createPlanId(),
    originalQuery,
    partitions,
    strategy,
    createdAt: new Date().toISOString(),
    totalPartitions: partitions.length,
  };
}

/**
 * Convenience helper for language partitioning.
 */
export function createLanguagePartitionPlan(
  query: string,
  languages: string[] = DEFAULT_LANGUAGES,
): PartitionPlan {
  return createPartitionPlan(query, {
    strategy: "language",
    languages,
  });
}

/**
 * Convenience helper for date partitioning.
 */
export function createDatePartitionPlan(
  query: string,
  options: Pick<
    PartitionOptions,
    | "dateField"
    | "dateFrom"
    | "dateTo"
    | "monthsPerPartition"
    | "maxPartitions"
  >,
): PartitionPlan {
  return createPartitionPlan(query, {
    ...options,
    strategy: "date",
  });
}

/**
 * Convenience helper for hybrid language + date partitioning.
 */
export function createHybridPartitionPlan(
  query: string,
  options: Pick<
    PartitionOptions,
    | "languages"
    | "dateField"
    | "dateFrom"
    | "dateTo"
    | "monthsPerPartition"
    | "maxPartitions"
  >,
): PartitionPlan {
  return createPartitionPlan(query, {
    ...options,
    strategy: "hybrid",
  });
}

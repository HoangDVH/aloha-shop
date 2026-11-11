/**
 * Standardized MongoDB BSON Date helpers with safe fallback support for legacy ISO strings.
 */

export function toMongoDate(value: unknown, fallback: Date = new Date()): Date {
  const parsed = toOptionalMongoDate(value);
  return parsed ?? fallback;
}

export function toOptionalMongoDate(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

export function toIsoString(value: unknown): string {
  const d = toOptionalMongoDate(value);
  return d ? d.toISOString() : "";
}

export function toEpochMs(value: unknown): number {
  const d = toOptionalMongoDate(value);
  return d ? d.getTime() : 0;
}

export type DateRangeBounds = {
  gte?: Date | string;
  gt?: Date | string;
  lte?: Date | string;
  lt?: Date | string;
};

/**
 * Builds a MongoDB filter on `field` matching both BSON Date values and legacy ISO-8601 strings.
 */
export function dateRangeMatch(
  field: string,
  bounds: DateRangeBounds
): Record<string, unknown> {
  const dateCond: Record<string, Date> = {};
  const strCond: Record<string, string> = {};

  const apply = (
    op: "$gte" | "$gt" | "$lte" | "$lt",
    raw: Date | string | undefined
  ) => {
    if (raw === undefined) return;
    const d = toOptionalMongoDate(raw);
    if (!d) return;
    dateCond[op] = d;
    strCond[op] = d.toISOString();
  };

  apply("$gte", bounds.gte);
  apply("$gt", bounds.gt);
  apply("$lte", bounds.lte);
  apply("$lt", bounds.lt);

  if (!Object.keys(dateCond).length) return {};

  return {
    $or: [{ [field]: dateCond }, { [field]: strCond }],
  };
}

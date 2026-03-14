import { Match, type MatchPattern } from "@bluelibs/runner";

export function defineSchema(
  shape: Record<string, unknown>,
  options?: { exact?: boolean }
) {
  const pattern = options?.exact
    ? Match.ObjectStrict(shape)
    : Match.ObjectIncluding(shape);

  return Match.compile(pattern);
}

export const finiteNumberPattern: MatchPattern = Match.Where(
  (value): value is number =>
    typeof value === "number" && Number.isFinite(value)
);

export const positiveNumberPattern: MatchPattern = Match.Where(
  (value): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0
);

export const integerNumberPattern: MatchPattern = Match.Where(
  (value): value is number =>
    typeof value === "number" && Number.isInteger(value)
);

export const nonNegativeIntegerPattern: MatchPattern = Match.Where(
  (value): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 0
);

export const minimumLengthPattern = (length: number): MatchPattern =>
  Match.Where(
    (value): value is string =>
      typeof value === "string" && value.length >= length
  );

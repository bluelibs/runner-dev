import { Match } from "@bluelibs/runner";

export function defineSchema(
  shape: Record<string, unknown>,
  options?: { exact?: boolean }
) {
  const pattern = options?.exact
    ? Match.ObjectStrict(shape)
    : Match.ObjectIncluding(shape);

  return Match.compile(pattern);
}

export const finiteNumberPattern = Match.Where(
  (value): value is number =>
    typeof value === "number" && Number.isFinite(value)
);

export const positiveNumberPattern = Match.Where(
  (value): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0
);

export const integerNumberPattern = Match.Where(
  (value): value is number =>
    typeof value === "number" && Number.isInteger(value)
);

export const nonNegativeIntegerPattern = Match.Where(
  (value): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 0
);

export const minimumLengthPattern = (length: number) =>
  Match.Where(
    (value): value is string =>
      typeof value === "string" && value.length >= length
  );

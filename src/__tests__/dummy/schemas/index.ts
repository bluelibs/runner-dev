import { Match } from "@bluelibs/runner";

export function defineSchema(
  shape: Record<string, unknown>,
  options?: { exact?: boolean }
) {
  class InlineSchema {}

  Match.Schema(options)(InlineSchema);
  for (const [key, pattern] of Object.entries(shape)) {
    Match.Field(pattern as never)(InlineSchema.prototype, key);
  }

  return Match.fromSchema(InlineSchema);
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
    (value): value is string => typeof value === "string" && value.length >= length
  );

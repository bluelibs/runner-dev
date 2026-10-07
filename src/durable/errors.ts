import z from "zod";

/** A request failure the dashboard can present without a server error. */
export class DurableHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function requireValue<T>(
  value: T | null | undefined,
  message: string
): T {
  if (value == null) throw new DurableHttpError(404, message);
  return value;
}

export function bodyRecord(input: unknown): Record<string, unknown> {
  return z.record(z.unknown()).parse(input ?? {});
}

export function nonEmpty(value: unknown): string {
  return z.string().trim().min(1).parse(value);
}

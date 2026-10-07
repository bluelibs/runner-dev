import z from "zod";
export const MIN_STORAGE_BYTES = 512 * 1024;
export type StorageSize = number | string;
/** Size strings use binary units; numbers are bytes. */
export function parseStorageSize(value: StorageSize): number {
  let bytes: number;
  if (typeof value === "number") bytes = value;
  else {
    const match = /^\s*(\d+(?:\.\d+)?)\s*(b|kb|kib|mb|mib|gb|gib)?\s*$/i.exec(
      value
    );
    if (!match)
      throw new Error(
        "maxStorage must be bytes or a size such as '512kb' or '1mb'."
      );
    const unit = (match[2] ?? "b").toLowerCase();
    const exponent = unit.startsWith("k")
      ? 1
      : unit.startsWith("m")
      ? 2
      : unit.startsWith("g")
      ? 3
      : 0;
    bytes = Number(match[1]) * 1024 ** exponent;
  }
  if (!Number.isSafeInteger(bytes) || bytes < MIN_STORAGE_BYTES)
    throw new Error(
      "maxStorage must be at least 512kb and a safe integer number of bytes."
    );
  return bytes;
}
export const storageSizeSchema = z
  .union([z.number(), z.string()])
  .superRefine((value, context) => {
    try {
      parseStorageSize(value);
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Invalid maxStorage",
      });
    }
  });

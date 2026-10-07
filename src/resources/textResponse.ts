import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { gzip, constants } from "node:zlib";

const compress = promisify(gzip);

function acceptsGzip(header: string | undefined): boolean {
  const qualities = new Map<string, number>();
  for (const entry of (header ?? "").split(",")) {
    const [coding, ...parameters] = entry.trim().toLowerCase().split(";");
    const quality = parameters.find((parameter) =>
      parameter.trim().startsWith("q=")
    );
    const value = quality ? Number(quality.trim().slice(2)) : 1;
    qualities.set(
      coding,
      Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0
    );
  }
  return (qualities.get("gzip") ?? qualities.get("*") ?? 0) > 0;
}

/** Prepare once, compress lazily and share the result across concurrent reads. */
export function createTextResponse(body: string, contentType: string) {
  const etag = `W/"${createHash("sha256").update(body).digest("base64url")}"`;
  let compressed: Promise<Buffer> | undefined;
  return async (req: Request, res: Response): Promise<void> => {
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, no-cache");
    res.setHeader("Vary", "Accept-Encoding");
    res.setHeader("ETag", etag);
    const validators = req.headers?.["if-none-match"];
    if (
      typeof validators === "string" &&
      validators
        .split(",")
        .some(
          (value) =>
            value.trim() === "*" ||
            value.trim().replace(/^W\//, "") === etag.slice(2)
        )
    ) {
      res.status(304).end();
      return;
    }
    if (body.length >= 1024 && acceptsGzip(req.headers?.["accept-encoding"])) {
      compressed ??= compress(body, { level: constants.Z_BEST_SPEED }).catch(
        (error: unknown) => {
          compressed = undefined;
          throw error;
        }
      );
      const data = await compressed;
      res.setHeader("Content-Encoding", "gzip");
      res.send(data);
    } else {
      res.send(body);
    }
  };
}

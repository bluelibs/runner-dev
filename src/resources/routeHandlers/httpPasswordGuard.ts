import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";

const AUTH_CHALLENGE = 'Basic realm="Runner DevTools", charset="UTF-8"';
const FAILURE_WINDOW_MS = 60_000;
const MAX_FAILURES = 20;
const MAX_TRACKED_CLIENTS = 1024;

function hashCredentials(credentials: Buffer): Buffer {
  // Equal-sized digests allow constant-time comparison regardless of input length.
  return createHash("sha256").update(credentials).digest();
}

function readCredentials(authorization: string | undefined): Buffer | null {
  const match = authorization?.match(/^Basic ([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return null;
  const credentials = Buffer.from(match[1], "base64");
  const unpadded = (value: string) => value.replace(/=+$/, "");
  return unpadded(credentials.toString("base64")) === unpadded(match[1])
    ? credentials
    : null;
}

function isCrossSiteRequest(req: Request): boolean {
  // Cached Basic credentials can accompany GET task routes as well as POSTs.
  const fetchSite = req.get("Sec-Fetch-Site");
  if (fetchSite === "cross-site" || fetchSite === "same-site") return true;
  const origin = req.get("Origin");
  if (origin === undefined) return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return true;
    // Use the browser-facing authority, including its port. HTTPS may terminate
    // at a reverse proxy; forwarded headers are deliberately not trusted here.
    const target = new URL(`${url.protocol}//${req.headers.host}`);
    return url.origin !== target.origin || origin !== url.origin;
  } catch {
    return true;
  }
}

function createFailureThrottle() {
  const clients = new Map<string, { count: number; expiresAt: number }>();
  return {
    clear(client: string) {
      clients.delete(client);
    },
    retryAfter(client: string): number {
      const failures = clients.get(client);
      return failures && failures.count >= MAX_FAILURES
        ? Math.max(0, Math.ceil((failures.expiresAt - Date.now()) / 1000))
        : 0;
    },
    record(client: string): number {
      const now = Date.now();
      let failures = clients.get(client);
      if (!failures || failures.expiresAt <= now) {
        if (!clients.has(client) && clients.size >= MAX_TRACKED_CLIENTS) {
          const oldest = clients.keys().next().value;
          if (oldest !== undefined) clients.delete(oldest);
        }
        failures = { count: 0, expiresAt: now + FAILURE_WINDOW_MS };
        clients.set(client, failures);
      }
      failures.count = Math.min(failures.count + 1, MAX_FAILURES);
      return failures.count >= MAX_FAILURES
        ? Math.ceil((failures.expiresAt - now) / 1000)
        : 0;
    },
  };
}

/** The password is read at startup, outside serializable resource configuration. */
export function createHttpPasswordGuard(
  password: string | undefined,
  passwordRequired = false
): RequestHandler {
  if (password === undefined && passwordRequired) {
    throw new Error("RUNNER_DEV_HTTP_PASSWORD is required in production mode.");
  }
  if (password === undefined) return (_req, _res, next) => next();
  if (password.trim() === "") {
    throw new Error("RUNNER_DEV_HTTP_PASSWORD must not be empty when set.");
  }
  const expected = hashCredentials(Buffer.from(`runner:${password}`, "utf8"));
  const throttle = createFailureThrottle();

  return (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (isCrossSiteRequest(req)) {
      res.status(403).json({
        errors: [{ message: "Forbidden: cross-site DevTools request." }],
      });
      return;
    }
    const client = req.socket.remoteAddress ?? "unknown";
    const blockedFor = throttle.retryAfter(client);
    if (blockedFor > 0) {
      res.setHeader("Retry-After", blockedFor);
      res.status(429).json({
        errors: [{ message: "Too many failed DevTools login attempts." }],
      });
      return;
    }
    const credentials = readCredentials(req.get("Authorization"));
    if (
      credentials &&
      timingSafeEqual(hashCredentials(credentials), expected)
    ) {
      throttle.clear(client);
      next();
      return;
    }
    const retryAfter = req.get("Authorization") ? throttle.record(client) : 0;
    if (retryAfter > 0) {
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({
        errors: [{ message: "Too many failed DevTools login attempts." }],
      });
      return;
    }
    res.setHeader("WWW-Authenticate", AUTH_CHALLENGE);
    res.status(401).json({
      errors: [{ message: "Runner DevTools authentication required." }],
    });
  };
}

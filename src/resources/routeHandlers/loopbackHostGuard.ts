import type { NextFunction, Request, Response } from "express";

/** Bind address used when no host is configured: this machine only. */
export const DEFAULT_BIND_HOST = "127.0.0.1";

/** Hostnames that always name this machine (IPv6 without brackets). */
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

const IPV4_LOOPBACK_RANGE = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export const LOOPBACK_HOST_REJECTION_MESSAGE =
  "Forbidden: this runner-dev server is bound to a loopback address and only " +
  "answers requests addressed to localhost, 127.0.0.1 or [::1] (Host header " +
  "check against DNS rebinding). To expose it on the network, configure an " +
  'explicit host, e.g. dev.with({ host: "0.0.0.0" }).';

function stripIpv6Brackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/** Whether listening on `host` keeps the server reachable from this machine only. */
export function isLoopbackBindHost(host: string): boolean {
  const normalized = stripIpv6Brackets(host.trim().toLowerCase());
  return (
    LOOPBACK_HOSTNAMES.has(normalized) || IPV4_LOOPBACK_RANGE.test(normalized)
  );
}

/**
 * Hostname part of a Host header: `localhost:1337` -> `localhost`,
 * `[::1]:1337` -> `::1`. Returns null for an empty header.
 */
export function parseHostHeaderHostname(hostHeader: string): string | null {
  const value = hostHeader.trim().toLowerCase();
  if (value === "") return null;
  if (value.startsWith("[")) {
    const closingBracket = value.indexOf("]");
    return closingBracket === -1 ? null : value.slice(1, closingBracket);
  }
  const portSeparator = value.indexOf(":");
  return portSeparator === -1 ? value : value.slice(0, portSeparator);
}

export function isLoopbackHostHeader(hostHeader: string | undefined): boolean {
  const hostname =
    hostHeader === undefined ? null : parseHostHeaderHostname(hostHeader);
  return hostname !== null && LOOPBACK_HOSTNAMES.has(hostname);
}

/**
 * Rejects requests whose Host header is not a loopback name.
 *
 * Binding to 127.0.0.1 alone does not stop DNS rebinding: a malicious page
 * can point its own domain at 127.0.0.1 and then call this server as a
 * same-origin request. The browser still sends the attacker's domain in the
 * Host header, which is what this guard refuses. A missing Host header is
 * refused too (fail closed); every HTTP/1.1 client sends one.
 */
export function createLoopbackHostGuard() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isLoopbackHostHeader(req.headers.host)) {
      next();
      return;
    }
    // GraphQL-shaped so GraphQL clients surface the message as-is.
    res
      .status(403)
      .json({ errors: [{ message: LOOPBACK_HOST_REJECTION_MESSAGE }] });
  };
}

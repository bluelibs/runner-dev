import { BlockList, isIP, isIPv6 } from "node:net";
import { domainToASCII } from "node:url";
import type { NextFunction, Request, Response } from "express";

/** Bind address used when no host is configured: this machine only. */
export const DEFAULT_BIND_HOST = "127.0.0.1";

export interface HostGuardOptions {
  /**
   * DNS names, besides `localhost`, that requests may address the server by
   * (for example a LAN name or a Docker Compose service name).
   */
  allowedHosts?: readonly string[];
}

const LOOPBACK_ADDRESSES = new BlockList();
LOOPBACK_ADDRESSES.addSubnet("127.0.0.0", 8, "ipv4");
LOOPBACK_ADDRESSES.addAddress("::1", "ipv6");

/**
 * Hostname in the form a Host header carries it: lowercased, without IPv6
 * brackets (`[::1]` -> `::1`), and in punycode (`bücher.lan` ->
 * `xn--bcher-kva.lan`), because browsers send internationalized names that
 * way.
 */
export function normalizeHostname(hostname: string): string {
  const value = hostname.trim().toLowerCase();
  const unbracketed =
    value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  // domainToASCII returns "" for what is not a domain, such as an IPv6
  // literal; those keep their own spelling.
  return domainToASCII(unbracketed) || unbracketed;
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

/**
 * Whether a request addressed to `hostname` may reach the server.
 *
 * `localhost` and IP literals always pass: DNS rebinding needs a DNS name the
 * attacker controls, and the browser sends that name in the Host header, so
 * a literal address only arrives from a client that dialed it directly. This
 * keeps Docker, LAN and loopback access by address working on every bind.
 */
export function isAllowedHostname(
  hostname: string,
  allowedHostnames: ReadonlySet<string>
): boolean {
  return (
    hostname === "localhost" ||
    isIP(hostname) !== 0 ||
    allowedHostnames.has(hostname)
  );
}

export function hostRejectionMessage(hostname: string | null): string {
  const received =
    hostname === null
      ? "The request had no Host header."
      : `To reach it as "${hostname}", list that name in allowedHosts, ` +
        `e.g. dev.with({ allowedHosts: ["${hostname}"] }).`;
  return (
    "Forbidden: this runner-dev server only answers requests addressed to " +
    "localhost, an IP address or a name in allowedHosts (Host header check " +
    `against DNS rebinding). ${received}`
  );
}

/**
 * Rejects requests whose Host header names neither this machine, an IP
 * address, nor a configured allowed host.
 *
 * The bind address alone does not stop DNS rebinding: a malicious page can
 * point its own domain at 127.0.0.1 (or at the address a Docker port is
 * published on) and then call this server as a same-origin request. The
 * browser still sends the attacker's domain in the Host header, which is
 * what this guard refuses, whatever interface the server listens on. A
 * missing Host header is refused too (fail closed); every HTTP/1.1 client
 * sends one.
 */
export function createHostGuard(options: HostGuardOptions = {}) {
  const allowedHostnames = new Set(
    (options.allowedHosts ?? []).map(normalizeHostname)
  );
  return (req: Request, res: Response, next: NextFunction) => {
    const hostHeader = req.headers.host;
    const hostname =
      hostHeader === undefined ? null : parseHostHeaderHostname(hostHeader);
    if (hostname !== null && isAllowedHostname(hostname, allowedHostnames)) {
      next();
      return;
    }
    // GraphQL-shaped so GraphQL clients surface the message as-is.
    res
      .status(403)
      .json({ errors: [{ message: hostRejectionMessage(hostname) }] });
  };
}

/**
 * Whether a bound socket address (as `server.address()` reports it) is
 * reachable from this machine only. Deciding from the bound address rather
 * than the configured string covers every spelling Node accepts for
 * loopback (`127.1`, `0:0:0:0:0:0:0:1`, `::ffff:127.0.0.1`, ...).
 */
export function isLoopbackAddress(address: string): boolean {
  return LOOPBACK_ADDRESSES.check(address, isIPv6(address) ? "ipv6" : "ipv4");
}

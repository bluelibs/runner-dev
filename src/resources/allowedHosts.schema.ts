import { domainToASCII } from "node:url";
import z from "zod";

export const ALLOWED_HOST_MESSAGE =
  'allowedHosts entries are exact hostnames without scheme, port or wildcard, e.g. "devbox.lan".';

/**
 * Dot-separated labels of letters, digits, "-" and "_" (Docker Compose
 * service names may contain "_"), with an optional trailing dot.
 */
const ASCII_HOSTNAME = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.?$/;

/**
 * Whether an entry can ever equal the hostname of a Host header. The guard
 * compares exact names, and browsers send internationalized names in
 * punycode, so the entry is checked in that form. A scheme, port, wildcard,
 * leading dot or userinfo would otherwise be accepted and allow nothing.
 */
function canMatchHostHeader(entry: string): boolean {
  return ASCII_HOSTNAME.test(domainToASCII(entry));
}

/**
 * Shared by every config that accepts `allowedHosts` (`dev` and `server`),
 * so each documented entry point rejects the same entries at `.with()`.
 */
export const allowedHostsSchema = z
  .array(z.string().refine(canMatchHostHeader, ALLOWED_HOST_MESSAGE))
  .optional();

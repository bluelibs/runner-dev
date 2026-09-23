import z from "zod";

export const ALLOWED_HOST_MESSAGE =
  'allowedHosts entries are hostnames without scheme or port, e.g. "devbox.lan".';

/**
 * Shared by every config that accepts `allowedHosts` (`dev` and `server`),
 * so each documented entry point rejects the same entries at `.with()`. A
 * scheme or port would never equal a Host hostname, so such an entry would
 * silently allow nothing.
 */
export const allowedHostsSchema = z
  .array(
    z
      .string()
      .min(1, ALLOWED_HOST_MESSAGE)
      .regex(/^[^:/\s]+$/, ALLOWED_HOST_MESSAGE)
  )
  .optional();

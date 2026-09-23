import type http from "node:http";

/**
 * How long connections that outlive `close()` may keep running before they
 * are cut: enough for an in-flight request to finish, short enough that
 * Ctrl+C still ends the process promptly.
 */
export const SHUTDOWN_GRACE_MS = 3_000;

/**
 * Stops listening and resolves once every connection has closed, cutting
 * whatever is still open after SHUTDOWN_GRACE_MS.
 *
 * `close()` destroys only idle sockets. A connection that is busy at that
 * moment (a request still arriving, or a response still being written)
 * survives it, and Node stops enforcing its header and request timeouts once
 * the server closes. Later requests on that connection could keep it alive,
 * or a request that never completes could hold it forever, and with it the
 * whole shutdown.
 */
export function closeHttpServer(httpServer: http.Server): Promise<void> {
  return new Promise((resolve) => {
    const cutRemainingConnections = setTimeout(
      () => httpServer.closeAllConnections(),
      SHUTDOWN_GRACE_MS
    );
    httpServer.close(() => {
      clearTimeout(cutRemainingConnections);
      resolve();
    });
  });
}

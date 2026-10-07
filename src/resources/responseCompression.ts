import compression from "compression";
import { constants } from "node:zlib";

export function createResponseCompression() {
  return compression({
    threshold: 1024,
    level: constants.Z_BEST_SPEED,
    brotli: { params: { [constants.BROTLI_PARAM_QUALITY]: 3 } },
    filter(req, res) {
      // Live telemetry must deliver events immediately, without a compression
      // buffer delaying small chunks. Also covers application-defined SSE.
      const contentType = String(res.getHeader("Content-Type") ?? "");
      if (
        contentType.split(";")[0].trim().toLowerCase() === "text/event-stream"
      )
        return false;
      return compression.filter(req, res);
    },
  });
}

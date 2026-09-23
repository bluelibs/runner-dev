import { dev } from "../../resources/dev.resource";
import { serverResource } from "../../resources/server.resource";

// Both are documented ways to set allowedHosts, so both must refuse an entry
// that can never equal a Host hostname instead of silently allowing nothing.
const ENTRY_POINTS = [
  {
    name: "dev.with",
    configure: (allowedHosts: string[]) => dev.with({ allowedHosts }),
  },
  {
    name: "resources.server.with",
    configure: (allowedHosts: string[]) =>
      serverResource.with({ allowedHosts }),
  },
];

const NEVER_MATCHING_ENTRIES = [
  "http://devbox.lan",
  "devbox.lan:1337",
  "",
  "dev box",
  // The guard compares exact names, so wildcard or subdomain syntax and
  // lists match nothing, and userinfo never reaches the Host header.
  "*.lan",
  ".lan",
  "user@devbox",
  "devbox,other",
];

describe.each(ENTRY_POINTS)("$name allowedHosts", ({ configure }) => {
  test.each(NEVER_MATCHING_ENTRIES)(
    "rejects entry %p with a clear message",
    (entry) => {
      expect(() => configure([entry])).toThrow(
        "allowedHosts entries are exact hostnames without scheme, port or wildcard"
      );
    }
  );

  test("accepts hostnames, Compose service names and Unicode names", () => {
    expect(() =>
      configure(["devbox.lan", "DevBox.LAN", "app", "my_service", "bücher.lan"])
    ).not.toThrow();
  });
});

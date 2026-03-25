import { r } from "@bluelibs/runner";

export const privateCacheResource = r
  .resource("private-cache")
  .meta({
    title: "Catalog Internal Cache",
    description:
      "Internal cache that supports catalog reads but stays outside the exported boundary.\n\n- Hidden from public docs surface\n- Useful for isolation and visibility checks",
  })
  .init(async () => ({
    entries: new Map<string, unknown>(),
  }))
  .build();

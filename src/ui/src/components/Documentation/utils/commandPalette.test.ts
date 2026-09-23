import {
  buildPaletteEntries,
  filterPaletteEntries,
  matchesFuzzyText,
  scoreEntry,
  type PaletteEntry,
} from "./commandPalette";

function elementEntry(
  id: string,
  elementKind = "resource",
  title?: string
): PaletteEntry {
  return { kind: "element", id, elementKind, title };
}

describe("commandPalette", () => {
  describe("buildPaletteEntries", () => {
    test("builds typed entries from source lists", () => {
      const entries = buildPaletteEntries({
        elements: [{ id: "runner.logger", kind: "resource", title: "Logger" }],
        sections: [{ id: "resources", label: "Resources", icon: "resource" }],
        actions: [{ id: "open-shell", label: "Open shell", icon: "terminal" }],
      });

      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual({
        kind: "element",
        id: "runner.logger",
        elementKind: "resource",
        title: "Logger",
      });
      expect(entries[1]).toEqual({
        kind: "section",
        id: "resources",
        label: "Resources",
        icon: "resource",
      });
      expect(entries[2]).toEqual({
        kind: "action",
        id: "open-shell",
        label: "Open shell",
        icon: "terminal",
        shortcut: undefined,
        keywords: undefined,
      });
    });
  });

  describe("scoreEntry", () => {
    test("returns 0 for an empty query", () => {
      expect(scoreEntry(elementEntry("a.b"), "   ")).toBe(0);
    });

    test("prefers exact matches over prefix, substring, and fuzzy matches", () => {
      const wordExact = elementEntry("logger", "resource");
      const prefixWord = elementEntry("loggerx", "resource");
      const substring = elementEntry("myloggerx", "resource");
      const fuzzy = elementEntry("l1o2g3g4e5r", "resource");

      const wordExactScore = scoreEntry(wordExact, "logger");
      const prefixScore = scoreEntry(prefixWord, "logger");
      const substringScore = scoreEntry(substring, "logger");
      const fuzzyScore = scoreEntry(fuzzy, "logger");

      expect(wordExactScore).toBeGreaterThan(prefixScore);
      expect(prefixScore).toBeGreaterThan(substringScore);
      expect(substringScore).toBeGreaterThan(fuzzyScore);
      expect(fuzzyScore).toBeGreaterThanOrEqual(0);
    });

    test("requires every query token to match", () => {
      const entry = elementEntry("app.catalog.search", "resource", "Search");
      expect(scoreEntry(entry, "catalog search")).toBeGreaterThanOrEqual(0);
      expect(scoreEntry(entry, "catalog missing")).toBe(-1);
    });

    test("scores word-prefix matches below exact words", () => {
      expect(scoreEntry(elementEntry("app.loggerx"), "logger")).toBe(50);
    });

    test("matches titles, kinds, labels, and keywords", () => {
      expect(
        scoreEntry(elementEntry("a.b", "resource", "Fancy Logger"), "fancy")
      ).toBeGreaterThanOrEqual(0);
      expect(
        scoreEntry(elementEntry("a.b", "hook"), "hook")
      ).toBeGreaterThanOrEqual(0);
      expect(
        scoreEntry(
          {
            kind: "section",
            id: "resources",
            label: "Resources",
            icon: "resource",
          },
          "resourc"
        )
      ).toBeGreaterThanOrEqual(0);
      expect(
        scoreEntry(
          {
            kind: "action",
            id: "open-shell",
            label: "Open shell",
            icon: "terminal",
            keywords: "repl console",
          },
          "console"
        )
      ).toBeGreaterThanOrEqual(0);
    });

    test("returns -1 when nothing matches", () => {
      expect(scoreEntry(elementEntry("aaa"), "zzz")).toBe(-1);
    });
  });

  describe("filterPaletteEntries", () => {
    const entries: PaletteEntry[] = [
      elementEntry("runner.logger", "resource", "Logger"),
      elementEntry("runner.timers", "resource", "Timers"),
      {
        kind: "section",
        id: "resources",
        label: "Resources",
        icon: "resource",
      },
      {
        kind: "action",
        id: "open-shell",
        label: "Open shell",
        icon: "terminal",
      },
    ];

    test("returns sections and actions first for an empty query", () => {
      const ranked = filterPaletteEntries(entries, "");
      expect(ranked.map((item) => item.entry.kind)).toEqual([
        "section",
        "action",
        "element",
        "element",
      ]);
      expect(ranked[2].entry.id).toBe("runner.logger");
      expect(ranked[3].entry.id).toBe("runner.timers");
    });

    test("ranks best matches first", () => {
      const ranked = filterPaletteEntries(
        [elementEntry("myloggerx", "task"), elementEntry("app.logger", "task")],
        "logger"
      );
      expect(ranked.map((item) => item.entry.id)).toEqual([
        "app.logger",
        "myloggerx",
      ]);
    });

    test("breaks score ties by id length, then alphabetically", () => {
      const tied = filterPaletteEntries(
        [
          elementEntry("app.zz-top", "task"),
          elementEntry("app.top", "task"),
          elementEntry("app.aaa-top", "task"),
        ],
        "top"
      );
      expect(tied.map((item) => item.entry.id)).toEqual([
        "app.top",
        "app.zz-top",
        "app.aaa-top",
      ]);
    });

    test("breaks full ties alphabetically", () => {
      const ranked = filterPaletteEntries(
        [elementEntry("app.b-top", "task"), elementEntry("app.a-top", "task")],
        "top"
      );
      expect(ranked.map((item) => item.entry.id)).toEqual([
        "app.a-top",
        "app.b-top",
      ]);
    });

    test("caps the number of element results", () => {
      const many = Array.from({ length: 20 }, (_, index) =>
        elementEntry(`app.item-${index}`, "task")
      );
      const ranked = filterPaletteEntries(many, "app", { elements: 5 });
      expect(ranked).toHaveLength(5);
    });

    test("caps sections and actions independently", () => {
      const ranked = filterPaletteEntries(entries, "", {
        elements: 1,
        sections: 0,
        actions: 0,
      });
      expect(ranked).toHaveLength(1);
      expect(ranked[0].entry.kind).toBe("element");
    });
  });

  describe("matchesFuzzyText", () => {
    test("matches tokens in any order with gaps", () => {
      expect(matchesFuzzyText("sync proj", "Projection Sync")).toBe(true);
      expect(matchesFuzzyText("ten alpha", "Alpha Ten")).toBe(true);
      expect(matchesFuzzyText("zlst", "enhanced-app.events.z-last")).toBe(true);
    });

    test("requires every token to match", () => {
      expect(matchesFuzzyText("alpha bravo", "Alpha Ten")).toBe(false);
    });

    test("matches everything on an empty query", () => {
      expect(matchesFuzzyText("   ", "Anything")).toBe(true);
    });

    const runnerIds = [
      "app.tasks.createUser",
      "app.tasks.deleteUser",
      "app.tasks.lookupOrg",
      "app.resources.logger",
      "app.middleware.globalLogging",
      "app.events.userCreated",
      "platform.config",
    ];
    const matchingIds = (query: string) =>
      runnerIds.filter((id) => matchesFuzzyText(query, id));

    test("short tokens only match as contiguous substrings", () => {
      expect(matchingIds("log")).toEqual([
        "app.resources.logger",
        "app.middleware.globalLogging",
      ]);
      expect(matchingIds("LOG")).toEqual(matchingIds("log"));
      // "lg" is a subsequence of logger/globalLogging, but too short to fuzz.
      expect(matchingIds("lg")).toEqual([]);
    });

    test("accepts tight abbreviations and rejects scattered characters", () => {
      // c-r-(eate)-u-s spans 8 characters for a 4-character token.
      expect(matchingIds("crus")).toEqual(["app.tasks.createUser"]);
      // c…u-s-(e)-r spans 10 characters: past the 2x budget.
      expect(matchingIds("cusr")).toEqual([]);
      expect(matchingIds("usr")).toEqual([
        "app.tasks.createUser",
        "app.tasks.deleteUser",
        "app.events.userCreated",
      ]);
      expect(matchingIds("dtb")).toEqual([]);
      expect(matchesFuzzyText("dtb", "app.resources.database")).toBe(true);
    });

    test("keeps the palette's looser subsequence ranking intact", () => {
      // The table filter rejects these scattered matches...
      expect(matchesFuzzyText("log", "app.tasks.lookupOrg")).toBe(false);
      expect(matchesFuzzyText("log", "platform.config")).toBe(false);
      // ...while the palette still lists them, ranked last.
      expect(
        scoreEntry(elementEntry("app.tasks.lookupOrg", "task"), "log")
      ).toBe(10);
      expect(scoreEntry(elementEntry("app.resources.logger"), "lg")).toBe(10);
    });
  });
});

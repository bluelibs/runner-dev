import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

const loadPackage = createRequire(__filename);
const micromatch = loadPackage("micromatch");
const loadFromMatcher = createRequire(loadPackage.resolve("micromatch"));
const braces = loadFromMatcher("braces");

test.each(["\n", "\r", "\u2028", "\u2029"])(
  "shell quoting rejects a line terminator after a comment (%j)",
  (newline) => {
    const quote = loadPackage("shell-quote");
    expect(() =>
      quote.quote(["echo", "ok", { comment: "x" }, `a${newline}id;#`])
    ).toThrow(TypeError);
    const words = ["echo", "a b", "it's quoted", "$literal"];
    expect(quote.parse(quote.quote(words))).toEqual(words);
  }
);

// A renamed package would clear audit without proving the installed fix works.
describe("braces depth-guard override", () => {
  test("loads the reviewed release through the actual matcher dependency", () => {
    expect(loadFromMatcher("braces/package.json")).toMatchObject({
      name: "@dieub/braces-depth-guard",
      version: "3.0.3-pn.3",
    });
  });

  test.each([
    ["{", "}"],
    ["(", ")"],
  ])(
    "rejects excessive %s nesting before recursive traversal",
    (open, close) => {
      const pattern = open.repeat(1000) + "a,b" + close.repeat(1000);
      for (const method of ["parse", "compile", "expand", "stringify"]) {
        expect(() => braces[method](pattern)).toThrow(/exceeds max depth/);
      }
      if (open === "{") {
        expect(() => micromatch.braces(pattern)).toThrow(/exceeds max depth/);
      } else {
        // The matcher skips brace expansion entirely for patterns without braces.
        expect(micromatch.braces(pattern)).toEqual([pattern]);
      }
    }
  );

  test.each(["compile", "expand", "stringify"])(
    "%s also bounds caller-supplied ASTs",
    (method) => {
      interface Node {
        type: string;
        value?: string;
        nodes?: Node[];
      }
      let ast: Node = { type: "text", value: "x" };
      for (let index = 0; index < 1000; index++) {
        ast = { type: "root", nodes: [ast] };
      }
      expect(() => braces[method](ast)).toThrow(
        /AST depth .*exceeds max depth/
      );
    }
  );

  test("invalid or oversized limits cannot disable the depth and length bounds", () => {
    const nested = "{".repeat(101) + "a,b" + "}".repeat(101);
    for (const maxDepth of [Infinity, NaN, 1000]) {
      expect(() => braces.parse(nested, { maxDepth })).toThrow(
        /exceeds max depth/
      );
    }
    expect(() => braces.parse("{{a,b}}", { maxDepth: 1.5 })).toThrow(
      /exceeds max depth/
    );
    expect(() => braces.parse("x".repeat(10_001), { maxLength: NaN })).toThrow(
      /maxLength/
    );
    const getDepth = jest.fn().mockReturnValueOnce(1).mockReturnValue(NaN);
    expect(() =>
      braces.parse("{{a,b}}", {
        get maxDepth() {
          return getDepth();
        },
      })
    ).toThrow(/exceeds max depth/);
    expect(getDepth).toHaveBeenCalledTimes(1);
  });

  test("expansion rejects cycles in caller-supplied AST parent chains", () => {
    interface Node {
      type: string;
      nodes: Node[];
      parent?: Node;
    }
    const ast: Node = { type: "custom", nodes: [] };
    ast.parent = ast;
    expect(() => braces.expand(ast)).toThrow(/parent chain contains a cycle/);
  });

  test("preserves ordinary glob matching, ranges, nesting and escaped braces", () => {
    expect(
      micromatch(
        ["src/app.ts", "src/ui/App.tsx", "src/app.js"],
        "src/**/*.{ts,tsx}"
      )
    ).toEqual(["src/app.ts", "src/ui/App.tsx"]);
    expect(braces.expand("src/{api,ui}/{a,b}.ts")).toEqual([
      "src/api/a.ts",
      "src/api/b.ts",
      "src/ui/a.ts",
      "src/ui/b.ts",
    ]);
    expect(braces.expand("file{1..3}.ts")).toEqual([
      "file1.ts",
      "file2.ts",
      "file3.ts",
    ]);
    expect(braces.stringify(braces.parse("a{b,{c,d}}"))).toBe("a{b,{c,d}}");
    expect(braces.expand(String.raw`file\{a,b\}.ts`)).toEqual(["file{a,b}.ts"]);
  });
});

test("the coverage configuration loader still reads YAML with the scoped upgrade", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "runner-dev-nyc-"));
  try {
    writeFileSync(path.join(directory, "package.json"), "{}\n");
    writeFileSync(
      path.join(directory, ".nycrc.yaml"),
      [
        "include:",
        "  - 'src/**/*.ts'",
        "exclude:",
        "  - '**/*.test.ts'",
        "check-coverage: true",
        "all: false",
        "",
      ].join("\n")
    );
    const loader = loadPackage("@istanbuljs/load-nyc-config");
    const loadFromCoverage = createRequire(
      loadPackage.resolve("@istanbuljs/load-nyc-config")
    );
    expect(loadFromCoverage("js-yaml/package.json").version).toMatch(/^4\./);
    await expect(
      loader.loadNycConfig({ cwd: directory })
    ).resolves.toMatchObject({
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts"],
      checkCoverage: true,
      all: false,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

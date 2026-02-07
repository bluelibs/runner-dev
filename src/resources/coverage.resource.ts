import { globals, resource } from "@bluelibs/runner";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { resolvePathInput } from "../utils/path";

export type CoverageSummary = {
  filePath: string;
  totalStatements: number;
  coveredStatements: number;
  percentage: number; // 0..100 rounded
};

export interface LineCoverage {
  line: number;
  hits: number;
  covered: boolean;
}

export type CoverageDetails = {
  statements?: Record<string, number>;
  functions?: Record<string, number>;
  branches?: Record<string, number>;
  lines?: LineCoverage[];
};

type LoadedCoverage = {
  kind: "json" | "clover";
  rawContents: string;
  summariesByAbsPath: Map<string, CoverageSummary>;
  detailsByAbsPath: Map<string, CoverageDetails>;
};

export interface CoverageService {
  getRawCoverageContents(): Promise<string | null>;
  getSummaryForAbsolutePath(absPath: string): Promise<CoverageSummary | null>;
  getDetailsForAbsolutePath(absPath: string): Promise<CoverageDetails | null>;
  getSummaryForPath(
    inputPath: string | null | undefined
  ): Promise<CoverageSummary | null>;
  getDetailsForPath(
    inputPath: string | null | undefined
  ): Promise<CoverageDetails | null>;
}

function normalizeAbs(p: string): string {
  try {
    return path.resolve(p);
  } catch {
    return p;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function readFileSafe(p: string): Promise<string | null> {
  try {
    return await fsp.readFile(p, "utf8");
  } catch {
    return null;
  }
}

function roundPct(n: number): number {
  if (!isFinite(n) || isNaN(n)) return 0;
  const r = Math.round(n);
  if (r < 0) return 0;
  if (r > 100) return 100;
  return r;
}

async function loadCoverageFromJson(jsonPath: string): Promise<LoadedCoverage> {
  const rawContents = (await readFileSafe(jsonPath)) || "";
  let data: any = {};
  try {
    data = JSON.parse(rawContents);
  } catch {
    data = {};
  }

  const summariesByAbsPath = new Map<string, CoverageSummary>();
  const detailsByAbsPath = new Map<string, CoverageDetails>();

  const cwd = process.cwd();
  // Expect data to be an object mapping filePath -> metrics
  if (data && typeof data === "object") {
    for (const [fileKey, metrics] of Object.entries<any>(data)) {
      const abs = normalizeAbs(
        path.isAbsolute(fileKey) ? fileKey : path.join(cwd, fileKey)
      );

      // Parse statement coverage
      const s: Record<string, number> = metrics?.s || {};
      const totalStatements = Object.keys(s).length;
      const coveredStatements = Object.values(s).filter(
        (hits) => (Number(hits) || 0) > 0
      ).length;
      const percentage =
        totalStatements > 0
          ? roundPct((coveredStatements / totalStatements) * 100)
          : 0;

      // Extract line coverage from statement map
      const lines: LineCoverage[] = [];
      for (const [statementKey, hits] of Object.entries(s)) {
        // Istanbul statement keys are in format "startLine:startColumn-endLine:endColumn"
        const match = statementKey.match(/^(\d+):\d+-\d+:\d+$/);
        if (match) {
          const line = parseInt(match[1], 10);
          const hitCount = Number(hits) || 0;
          lines.push({
            line,
            hits: hitCount,
            covered: hitCount > 0,
          });
        }
      }

      // Sort lines by line number and remove duplicates
      const uniqueLines = lines
        .sort((a, b) => a.line - b.line)
        .filter(
          (line, index, array) =>
            index === 0 || line.line !== array[index - 1].line
        );

      summariesByAbsPath.set(abs, {
        filePath: abs,
        totalStatements,
        coveredStatements,
        percentage,
      });

      // Store enhanced coverage details
      const details: CoverageDetails = {
        statements: s,
        functions: metrics?.f || {},
        branches: metrics?.b || {},
        lines: uniqueLines,
      };
      detailsByAbsPath.set(abs, details);
    }
  }

  return {
    kind: "json",
    rawContents,
    summariesByAbsPath,
    detailsByAbsPath,
  };
}

async function loadCoverageFromClover(
  cloverPath: string
): Promise<LoadedCoverage> {
  const rawContents = (await readFileSafe(cloverPath)) || "";
  const summariesByAbsPath = new Map<string, CoverageSummary>();
  const detailsByAbsPath = new Map<string, CoverageDetails>();
  const cwd = process.cwd();

  // Very lightweight parser: iterate <file path="..."> ... <metrics statements="x" coveredstatements="y" .../>
  const fileBlocks = [
    ...rawContents.matchAll(
      /<file[^>]*path="([^"]+)"[^>]*>([\s\S]*?)<\/file>/g
    ),
  ];
  for (const m of fileBlocks) {
    const filePathAttr = m[1];
    const inner = m[2] || "";
    const metricsMatch = inner.match(
      /<metrics[^>]*statements="(\d+)"[^>]*coveredstatements="(\d+)"/
    );
    const totalStatements = metricsMatch ? Number(metricsMatch[1]) : 0;
    const coveredStatements = metricsMatch ? Number(metricsMatch[2]) : 0;
    const percentage =
      totalStatements > 0
        ? roundPct((coveredStatements / totalStatements) * 100)
        : 0;
    const abs = normalizeAbs(
      path.isAbsolute(filePathAttr)
        ? filePathAttr
        : path.join(cwd, filePathAttr)
    );

    // Parse line coverage from Clover XML
    const lines: LineCoverage[] = [];
    const lineMatches = [
      ...inner.matchAll(/<line[^>]*num="(\d+)"[^>]*count="(\d+)"/g),
    ];
    for (const lineMatch of lineMatches) {
      const lineNum = parseInt(lineMatch[1], 10);
      const count = parseInt(lineMatch[2], 10);
      lines.push({
        line: lineNum,
        hits: count,
        covered: count > 0,
      });
    }

    summariesByAbsPath.set(abs, {
      filePath: abs,
      totalStatements,
      coveredStatements,
      percentage,
    });

    const details: CoverageDetails = {
      statements: { total: totalStatements, covered: coveredStatements },
      lines: lines.sort((a, b) => a.line - b.line),
    };
    detailsByAbsPath.set(abs, details);
  }

  return {
    kind: "clover",
    rawContents,
    summariesByAbsPath,
    detailsByAbsPath,
  };
}

async function tryLoadCoverage(): Promise<LoadedCoverage | null> {
  const cwd = process.cwd();
  const jsonPath = path.join(cwd, "coverage", "coverage-final.json");
  const cloverPath = path.join(cwd, "coverage", "clover.xml");

  if (await fileExists(jsonPath)) {
    return await loadCoverageFromJson(jsonPath);
  }
  if (await fileExists(cloverPath)) {
    return await loadCoverageFromClover(cloverPath);
  }
  return null;
}

export const coverage = resource({
  id: "runner-dev.resources.coverage",
  meta: {
    title: "Code Coverage Service",
    description:
      "Loads and parses test coverage data from JSON or Clover XML files to provide coverage statistics",
  },
  dependencies: {
    // Keep ability to access store if needed later
    store: globals.resources.store,
  },
  async init(_config, _deps): Promise<CoverageService> {
    let cached: LoadedCoverage | null = null;
    let _lastLoadTs = 0;

    async function ensureLoaded(): Promise<void> {
      // Basic freshness check: reload if file changed time? For now, load once per process or when missing.
      if (cached) return;
      cached = await tryLoadCoverage();
      _lastLoadTs = Date.now();
    }

    async function getRawCoverageContents(): Promise<string | null> {
      await ensureLoaded();
      return cached?.rawContents ?? null;
    }

    async function getSummaryForAbsolutePath(
      absPath: string
    ): Promise<CoverageSummary | null> {
      await ensureLoaded();
      if (!cached) return null;
      const key = normalizeAbs(absPath);
      return cached.summariesByAbsPath.get(key) ?? null;
    }

    async function getDetailsForAbsolutePath(
      absPath: string
    ): Promise<CoverageDetails | null> {
      await ensureLoaded();
      if (!cached) return null;
      const key = normalizeAbs(absPath);
      const details = cached.detailsByAbsPath.get(key);
      return details ?? null;
    }

    async function getSummaryForPath(
      inputPath: string | null | undefined
    ): Promise<CoverageSummary | null> {
      if (!inputPath) return null;
      const abs = resolvePathInput(inputPath) || inputPath;
      return await getSummaryForAbsolutePath(abs);
    }

    async function getDetailsForPath(
      inputPath: string | null | undefined
    ): Promise<CoverageDetails | null> {
      if (!inputPath) return null;
      const abs = resolvePathInput(inputPath) || inputPath;
      return await getDetailsForAbsolutePath(abs);
    }

    return {
      getRawCoverageContents,
      getSummaryForAbsolutePath,
      getDetailsForAbsolutePath,
      getSummaryForPath,
      getDetailsForPath,
    };
  },
});

export type Coverage = CoverageService;

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { spawn } from "child_process";

export async function ensureEmptyDir(dir: string): Promise<void> {
  if (fs.existsSync(dir)) {
    const entries = await fsp.readdir(dir);
    if (entries.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `Target directory '${path.basename(
          dir
        )}' already exists and is not empty.`
      );
      process.exit(1);
    }
    return;
  }
  await fsp.mkdir(dir, { recursive: true });
}

export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

export async function writeJson(
  filePath: string,
  data: unknown
): Promise<void> {
  const content = JSON.stringify(data, null, 2) + "\n";
  await writeFile(filePath, content);
}

export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  await fsp.writeFile(filePath, content, { encoding: "utf8" });
}

export async function writeGitignore(targetDir: string): Promise<void> {
  const content = `node_modules\n.dist\ndist\n.env\n\n`;
  await writeFile(path.join(targetDir, ".gitignore"), content);
}

export async function runCommand(
  cmd: string,
  args: string[],
  cwd: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

export function parseFlags(args: string[]): {
  flagSet: Set<string>;
  flagGet: (name: string) => string | undefined;
} {
  const values = new Map<string, string | undefined>();
  const set = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a || !a.startsWith("--")) continue;
    const keyValue = a.slice(2);
    const eqIdx = keyValue.indexOf("=");
    if (eqIdx !== -1) {
      const k = keyValue.slice(0, eqIdx);
      const v = keyValue.slice(eqIdx + 1);
      set.add(k);
      values.set(k, v);
    } else {
      const k = keyValue;
      set.add(k);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        values.set(k, next);
        i++; // consume value
      } else {
        values.set(k, undefined); // boolean flag
      }
    }
  }
  return {
    flagSet: set,
    flagGet: (name: string) => {
      const v = values.get(name);
      return v === undefined ? undefined : v;
    },
  };
}

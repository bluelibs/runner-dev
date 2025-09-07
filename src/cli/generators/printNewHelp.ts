import { c, divider, alignRows, indentLines } from "../format";

// scaffold moved to ./generators/scaffold.ts
// ...helper functions moved to ./generators/initUtils.ts
export function printNewHelp(): void {
  // eslint-disable-next-line no-console
  console.log(
    [
      "",
      c.title("runner-dev new"),
      divider(),
      alignRows(
        [
          [c.cmd("runner-dev new help"), "Show this help"],
          [c.cmd("runner-dev new project <name>"), "Scaffold a new project"],
          [c.cmd("runner-dev new resource <name>"), "Scaffold resource"],
          [c.cmd("runner-dev new task <name>"), "Scaffold task"],
          [c.cmd("runner-dev new event <name>"), "Scaffold event"],
          [c.cmd("runner-dev new hook <name>"), "Scaffold hook"],
          [c.cmd("runner-dev new tag <name>"), "Scaffold tag"],
          [
            c.cmd("runner-dev new taskMiddleware <name>"),
            "Scaffold task middleware",
          ],
          [
            c.cmd("runner-dev new resourceMiddleware <name>"),
            "Scaffold resource middleware",
          ],
        ],
        { gap: 3, indent: 2 }
      ),
      "",
      c.bold("Flags"),
      alignRows(
        [
          [
            c.yellow("--install"),
            "Install dependencies after project scaffold",
          ],
          [c.yellow("--run"), "Run 'npm run dev' after project scaffold"],
          [c.yellow("--run-tests"), "Run 'npm test' after project scaffold"],
          [
            c.yellow("--ns=<namespace>"),
            "Namespace for id (default: app). Also maps to path as <dir>/<ns>/<type>.",
          ],
          [c.yellow("--id=<id>"), "Explicit id override (ex: app.tasks.save)"],
          [c.yellow("--dir=<dir>"), "Base directory (default: src)"],
          [c.yellow("--export"), "Append export to <dir>/.../index.ts"],
          [c.yellow("--dry"), "Print file to stdout, do not write"],
          [c.yellow("--force"), "Allow overwriting existing files"],
        ],
        { gap: 3, indent: 2 }
      ),
      "",
      c.bold("Examples"),
      indentLines(
        [
          `${c.gray("# Project")}`,
          `${c.cmd("runner-dev new my-app")}`,
          `${c.gray("# Resource")}`,
          `${c.cmd(
            "runner-dev new resource user-service --ns app --dir src --export"
          )}`,
          `${c.gray("# Task")}`,
          `${c.cmd(
            "runner-dev new task create-user --ns app.users --dir src --export"
          )}`,
          `${c.gray("# Event")}`,
          `${c.cmd(
            "runner-dev new event user-registered --ns app.users --dir src --export"
          )}`,
          `${c.gray("# Hook")}`,
          `${c.cmd(
            "runner-dev new hook send-welcome --ns app.users --dir src --export"
          )}`,
          `${c.gray("# Tag")}`,
          `${c.cmd("runner-dev new tag http --ns app.web --dir src --export")}`,
          `${c.gray("# Middleware")}`,
          `${c.cmd(
            "runner-dev new task-middleware auth --ns app --dir src --export"
          )}`,
          `${c.cmd(
            "runner-dev new resource-middleware soft-delete --ns app --dir src --export"
          )}`,
        ].join("\n"),
        2
      ),
      "",
    ].join("\n")
  );
}

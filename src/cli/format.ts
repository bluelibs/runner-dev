// Lightweight CLI formatting utilities with optional ANSI colors

const FORCE_COLOR = process.env.FORCE_COLOR;
const NO_COLOR = process.env.NO_COLOR;

const isColorEnabled = Boolean(
  (FORCE_COLOR && FORCE_COLOR !== "0") ||
    (!NO_COLOR && process.stdout && process.stdout.isTTY)
);

function wrap(open: number, close: number) {
  return (input: string): string =>
    isColorEnabled ? `\u001b[${open}m${input}\u001b[${close}m` : input;
}

function chain(...stylers: Array<(s: string) => string>) {
  return (input: string): string => stylers.reduce((acc, fn) => fn(acc), input);
}

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  underline: wrap(4, 24),
  cyan: wrap(36, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  magenta: wrap(35, 39),
  gray: wrap(90, 39),
  // Convenience combos
  title: chain(wrap(1, 22), wrap(36, 39)), // bold + cyan
  cmd: chain(wrap(32, 39), wrap(1, 22)), // green + bold
};

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

export function stripAnsi(input: string): string {
  return input.replace(ANSI_PATTERN, "");
}

export function indentLines(input: string, spaces = 2): string {
  const pad = " ".repeat(spaces);
  return input
    .split("\n")
    .map((line) => (line.length ? pad + line : line))
    .join("\n");
}

export function alignRows(
  rows: Array<[string, string]>,
  options: { gap?: number; indent?: number } = {}
): string {
  const gap = options.gap ?? 2;
  const leftIndent = options.indent ?? 2;
  const labelWidth = rows.reduce((max, [label]) => {
    const width = stripAnsi(label).length;
    return width > max ? width : max;
  }, 0);
  const prefix = " ".repeat(leftIndent);
  return rows
    .map(([label, desc]) => {
      const visibleLen = stripAnsi(label).length;
      const spaces = Math.max(0, labelWidth - visibleLen + gap);
      return `${prefix}${label}${" ".repeat(spaces)}${desc}`;
    })
    .join("\n");
}

export function divider(width = 60): string {
  return "-".repeat(width);
}

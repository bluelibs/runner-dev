const FORCE_COLOR = process.env.FORCE_COLOR;
const NO_COLOR = process.env.NO_COLOR;

export const isColorEnabled = Boolean(
  (FORCE_COLOR && FORCE_COLOR !== "0") ||
    (!NO_COLOR && process.stdout && process.stdout.isTTY)
);
export const isInteractiveTerminal = Boolean(process.stdout?.isTTY);

export function wrap(open: number, close: number, input: string) {
  return isColorEnabled ? `\u001b[${open}m${input}\u001b[${close}m` : input;
}

export function bold(input: string) {
  return wrap(1, 22, input);
}

export function dim(input: string) {
  return wrap(2, 22, input);
}

export function cyan(input: string) {
  return wrap(36, 39, input);
}

export function magenta(input: string) {
  return wrap(35, 39, input);
}

export function green(input: string) {
  return wrap(32, 39, input);
}

export function yellow(input: string) {
  return wrap(33, 39, input);
}

export function red(input: string) {
  return wrap(31, 39, input);
}

export function gray(input: string) {
  return wrap(90, 39, input);
}

export function pad(value: string, length: number) {
  return value.padEnd(length, " ");
}

export function formatDuration(durationMs: number) {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(2)}s`;
}

function clearActiveLine() {
  if (!isInteractiveTerminal) return;
  process.stdout.write("\r\x1b[2K");
}

export function createSpinner(
  label: string,
  options: {
    intervalMs?: number;
    idleText?: string;
    nonInteractivePrefix?: string;
  } = {}
) {
  const frames = ["-", "\\", "|", "/"];
  const intervalMs = options.intervalMs ?? 80;
  const idleText = options.idleText ?? "working...";
  const nonInteractivePrefix = options.nonInteractivePrefix ?? "[*]";
  let frameIndex = 0;
  let interval: NodeJS.Timeout | undefined;

  const render = () => {
    const frame = frames[frameIndex % frames.length];
    frameIndex += 1;
    clearActiveLine();
    process.stdout.write(
      `${cyan(`[${frame}]`)} ${bold(label)} ${dim(idleText)}`
    );
  };

  return {
    start() {
      if (!isInteractiveTerminal) {
        console.log(
          `${cyan(nonInteractivePrefix)} ${bold(label)} ${dim(idleText)}`
        );
        return;
      }

      if (interval) return;
      render();
      interval = setInterval(render, intervalMs);
    },
    stop(message: string) {
      if (interval) {
        clearInterval(interval);
        interval = undefined;
      }
      if (isInteractiveTerminal) clearActiveLine();
      console.log(message);
    },
  };
}

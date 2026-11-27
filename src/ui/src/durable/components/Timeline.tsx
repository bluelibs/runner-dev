import { NODE_KIND_META } from "../../../../durable/shared/statuses";
import type {
  StudioGraphEdge,
  StudioNodeKind,
  StudioTimelineNode,
} from "../../../../durable/shared/types";
import { formatClock, formatCountdown } from "../format";
import { JsonView } from "./JsonView";
import { NodeStateTag } from "./StatusPill";

function KindIcon({ kind }: { kind: StudioNodeKind }) {
  const props = {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "signal":
      return (
        <svg {...props}>
          <path d="M8 2a4 4 0 0 1 4 4c0 3 1 4 1 4H3s1-1 1-4a4 4 0 0 1 4-4Z" />
          <path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" />
        </svg>
      );
    case "sleep":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="5.5" />
          <path d="M8 5v3l2 1.5" />
        </svg>
      );
    case "switch":
      return (
        <svg {...props}>
          <circle cx="4" cy="4" r="1.6" />
          <circle cx="4" cy="12" r="1.6" />
          <circle cx="12" cy="8" r="1.6" />
          <path d="M5.5 4.5 10.5 7.5M5.5 11.5l5-3" />
        </svg>
      );
    case "child":
      return (
        <svg {...props}>
          <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
          <path d="M2.5 6.5h11" />
        </svg>
      );
    case "command":
      return (
        <svg {...props}>
          <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
          <path d="M5 6l2.5 2L5 10M8.5 10H11" />
        </svg>
      );
    case "state":
      return (
        <svg {...props}>
          <ellipse cx="8" cy="4.5" rx="4.5" ry="2" />
          <path d="M3.5 4.5v7c0 1.1 2 2 4.5 2s4.5-.9 4.5-2v-7" />
          <path d="M3.5 8c0 1.1 2 2 4.5 2s4.5-.9 4.5-2" />
        </svg>
      );
    case "continue":
      return (
        <svg {...props}>
          <path d="M3 8a5 5 0 0 1 8.5-3.5L13 6" />
          <path d="M13 2.5V6H9.5" />
          <path d="M13 8a5 5 0 0 1-8.5 3.5L3 10" />
        </svg>
      );
    case "note":
      return (
        <svg {...props}>
          <path d="M4 2.5h6l2 2v9H4Z" />
          <path d="M10 2.5v2h2M6 8h4M6 10.5h4" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
          <path d="M5.5 8.2 7.3 10l3.2-3.6" />
        </svg>
      );
  }
}

function formatInternalStepLabel(stepId: string): string {
  if (stepId.startsWith("__state:write:")) {
    const index = Number(stepId.slice("__state:write:".length));
    return Number.isInteger(index)
      ? `State update #${index + 1}`
      : "State update";
  }
  if (stepId.startsWith("__signal:")) {
    return `Signal · ${stepId.slice("__signal:".length)}`;
  }
  if (stepId.startsWith("__sleep:")) {
    return `Sleep · ${stepId.slice("__sleep:".length)}`;
  }
  if (stepId === "__continue") {
    return "Continue as new";
  }
  return stepId;
}

function findJsonStringEnd(text: string, openQuoteIndex: number): number {
  let escaped = false;
  for (let index = openQuoteIndex + 1; index < text.length; index += 1) {
    const ch = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      return index + 1;
    }
  }
  return -1;
}

function displayNodeLabel(node: StudioTimelineNode): string {
  if (node.label !== node.id) return node.label;
  if (node.id.startsWith("__command:[")) {
    try {
      const tuple = JSON.parse(node.id.slice("__command:".length));
      if (Array.isArray(tuple) && typeof tuple[1] === "string") {
        const shortTask = tuple[1].split(".").pop() ?? tuple[1];
        return `Command · ${shortTask}`;
      }
    } catch {
      // Fall back to raw id when custom adapters use non-JSON command ids.
    }
  }
  if (node.id.startsWith("__command-step:")) {
    const prefixLength = "__command-step:".length;
    if (node.id[prefixLength] === '"') {
      const end = findJsonStringEnd(node.id, prefixLength);
      if (end > prefixLength && node.id[end] === ":") {
        const suffix = node.id.slice(end + 1);
        return `Command step · ${formatInternalStepLabel(suffix)}`;
      }
    }
    const separator = node.id.indexOf("]:");
    if (separator >= 0) {
      const suffix = node.id.slice(separator + 2);
      return `Command step · ${formatInternalStepLabel(suffix)}`;
    }
  }
  return formatInternalStepLabel(node.id);
}

function branchOf(nodeId: string, edges: StudioGraphEdge[]): string | null {
  const incoming = edges.find(
    (edge) => edge.to === nodeId && edge.branch !== undefined
  );
  return incoming?.branch ?? incoming?.label ?? null;
}

export function Timeline({
  nodes,
  edges,
  now,
  onSignal,
  disabled = false,
  canReset = false,
  onResetBeforeStep,
}: {
  nodes: StudioTimelineNode[];
  edges: StudioGraphEdge[];
  now: number;
  onSignal: (signalId: string) => void;
  disabled?: boolean;
  canReset?: boolean;
  onResetBeforeStep?: (stepId: string) => void;
}) {
  return (
    <ol className="timeline">
      {nodes.map((node, index) => {
        const last = index === nodes.length - 1;
        const branch = branchOf(node.id, edges);
        const countdownTarget =
          node.wait?.timeoutAtMs ?? node.wait?.fireAtMs ?? null;
        const showKindChip =
          node.kind === "command" ||
          node.kind === "state" ||
          node.kind === "continue" ||
          node.kind === "child";
        const showReset = Boolean(
          canReset && node.resettable && onResetBeforeStep
        );
        return (
          <li
            key={node.id}
            className={`tl-node state-${node.state}${
              node.parentStepId ? " nested" : ""
            }`}
          >
            <div className="tl-rail" aria-hidden="true">
              <span className="tl-dot">
                <KindIcon kind={node.kind} />
              </span>
              {!last ? <span className="tl-line" /> : null}
            </div>
            <div className="tl-card">
              <div className="tl-top">
                <div className="tl-title-group">
                  <span className="tl-label">{displayNodeLabel(node)}</span>
                  {showKindChip ? (
                    <span className={`tl-kind-chip kind-${node.kind}`}>
                      {NODE_KIND_META[node.kind].label}
                    </span>
                  ) : null}
                  {node.workflowVersion !== undefined ? (
                    <span className="version-badge">
                      v{node.workflowVersion}
                    </span>
                  ) : null}
                </div>
                <NodeStateTag state={node.state} />
              </div>
              <p className="tl-desc">{node.description}</p>
              <div className="tl-meta">
                <code className="tl-id">{node.id}</code>
                {node.taskKey && node.taskKey !== node.id ? (
                  <code className="tl-task-key">{node.taskKey}</code>
                ) : null}
                {node.parentStepId ? (
                  <span className="tl-parent">inside {node.parentStepId}</span>
                ) : null}
                {branch ? <span className="branch-chip">{branch}</span> : null}
                {node.branchTaken ? (
                  <span className="branch-chip taken">
                    → {node.branchTaken}
                  </span>
                ) : null}
                {node.completedAt ? (
                  <span className="tl-time">
                    {formatClock(node.completedAt)}
                  </span>
                ) : null}
              </div>
              {node.state === "waiting" && countdownTarget !== null ? (
                <p className="tl-wait">
                  {node.wait?.signalId ? "times out in " : "fires in "}
                  <strong>{formatCountdown(countdownTarget, now)}</strong>
                </p>
              ) : null}
              {(node.state === "waiting" && node.wait?.signalId) ||
              showReset ? (
                <div className="tl-actions">
                  {node.state === "waiting" && node.wait?.signalId ? (
                    <button
                      type="button"
                      disabled={disabled}
                      className="btn small primary"
                      onClick={() => onSignal(node.wait!.signalId!)}
                    >
                      Send {node.wait.signalId}
                    </button>
                  ) : null}
                  {showReset ? (
                    <button
                      type="button"
                      disabled={disabled}
                      className="btn small ghost"
                      onClick={() => onResetBeforeStep!(node.id)}
                      title={`Branch execution re-running from '${node.id}'`}
                    >
                      Reset before
                    </button>
                  ) : null}
                </div>
              ) : null}
              {node.result !== null && node.result !== undefined ? (
                <JsonView value={node.result} collapsed label="result" />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

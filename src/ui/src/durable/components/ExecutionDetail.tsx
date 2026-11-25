import type { DurableRuntimeCapabilities } from "../../../../durable/shared/runtime";
import { useState } from "react";
import type {
  StudioExecutionDetail,
  StudioRetentionSchedule,
  StudioWorkflow,
} from "../../../../durable/shared/types";
import { isLiveStatus } from "../../../../durable/shared/statuses";
import { formatDateTime, formatDuration, timeAgo, truncateId } from "../format";
import { JsonView } from "./JsonView";
import { ExecutionRelations } from "./ExecutionRelations";
import { SignalHistory } from "./SignalHistory";
import { StatusPill } from "./StatusPill";
import { Timeline } from "./Timeline";

type Tab = "timeline" | "relations" | "signals" | "data" | "audit";

function formatRetentionLabel(
  schedule: StudioRetentionSchedule | undefined
): string {
  if (!schedule || schedule === "retain") return "Retain";
  if (schedule === "delete") return "Delete immediately";
  const ms = schedule.afterMs;
  if (ms === 0) return "Immediately (0ms)";
  if (ms % 86_400_000 === 0) return `After ${ms / 86_400_000}d`;
  if (ms % 3_600_000 === 0) return `After ${ms / 3_600_000}h`;
  if (ms % 60_000 === 0) return `After ${ms / 60_000}m`;
  if (ms % 1000 === 0) return `After ${ms / 1000}s`;
  return `After ${ms}ms`;
}

const AUDIT_LABELS: Record<string, string> = {
  execution_status_changed: "Status changed",
  step_completed: "Step completed",
  sleep_scheduled: "Sleep scheduled",
  sleep_completed: "Sleep completed",
  signal_waiting: "Waiting for signal",
  signal_delivered: "Signal delivered",
  signal_timed_out: "Signal timed out",
  emit_published: "Event emitted",
  switch_evaluated: "Branch evaluated",
  note: "Note",
};

export function ExecutionDetail({
  disabled = false,
  capabilities,
  detail,
  workflow,
  now,
  onSignal,
  onCommand,
  onCancel,
  onRetry,
  onPause,
  onResume,
  onRestart,
  onReset,
  onExportReplay,
  onForceFail,
  onSkip,
  onEdit,
  onExport,
  onOpenExecution,
}: {
  disabled?: boolean;
  capabilities: DurableRuntimeCapabilities;
  detail: StudioExecutionDetail;
  workflow: StudioWorkflow | undefined;
  now: number;
  onSignal: (signalId?: string) => void;
  onCommand?: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReset?: (beforeStep?: string) => void;
  onExportReplay?: () => void;
  onForceFail: () => void;
  onSkip: () => void;
  onEdit: () => void;
  onExport: () => void;
  onOpenExecution: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("timeline");
  const live = isLiveStatus(detail.status);
  const paused = detail.status === "paused";
  const canRetry =
    detail.status === "failed" || detail.status === "compensation_failed";
  const canRestart =
    (!live || paused) &&
    (detail.status !== "continued_as_new" ||
      (detail.continuedChainTipStatus !== undefined &&
        (!isLiveStatus(detail.continuedChainTipStatus) ||
          detail.continuedChainTipStatus === "paused")));
  const matchingVersion = workflow?.versions?.find(
    (entry) => entry.version === (detail.workflowVersion ?? null)
  );
  const workflowSignals = matchingVersion?.signals ?? workflow?.signals ?? [];
  const workflowCommands =
    matchingVersion?.commands ?? workflow?.commands ?? [];
  const waitingSignals = detail.timeline.filter(
    (node) => node.state === "waiting" && node.wait?.signalId
  );
  const canReset =
    detail.historyRecorded === true &&
    !detail.historyCollectedAt &&
    (!live || paused) &&
    (detail.resettableSteps?.length ?? 0) > 0;
  const canExportReplay =
    detail.historyRecorded === true && !detail.historyCollectedAt;

  async function copyId() {
    try {
      await navigator.clipboard.writeText(detail.id);
    } catch {
      // Selection still works where clipboard is unavailable.
    }
  }

  return (
    <fieldset
      className="detail"
      disabled={disabled}
      aria-label="Execution details"
    >
      <header className="detail-head">
        <div className="detail-title-row">
          <div>
            <div className="detail-heading-line">
              <h2>{detail.workflowTitle}</h2>
              {detail.workflowVersion !== undefined ? (
                <span className="version-badge">v{detail.workflowVersion}</span>
              ) : null}
              {detail.historyCollectedAt ? (
                <span className="micro-badge">History collected</span>
              ) : null}
            </div>
            <button
              type="button"
              className="id-copy"
              onClick={copyId}
              title="Copy execution id"
            >
              <code>{truncateId(detail.id, 16)}</code>
            </button>
          </div>
          <StatusPill status={detail.status} />
        </div>
        {detail.position ? (
          <p className="detail-position">{detail.position}</p>
        ) : null}
        {detail.resetFromExecutionId ? (
          <div className="branch-banner">
            <span>
              Branched from{" "}
              <button
                type="button"
                className="inline-link"
                onClick={() => onOpenExecution(detail.resetFromExecutionId!)}
              >
                <code>{truncateId(detail.resetFromExecutionId, 16)}</code>
              </button>
              {detail.resetBeforeStep ? (
                <>
                  {" "}
                  before <code>{detail.resetBeforeStep}</code>
                </>
              ) : null}
              {detail.resetReason ? ` — ${detail.resetReason}` : null}
            </span>
          </div>
        ) : null}
        {detail.historyCollectedAt ? (
          <div className="info-banner">
            History collected on {formatDateTime(detail.historyCollectedAt)}.
            The completion receipt and result remain preserved.
          </div>
        ) : null}
        <div className="detail-facts">
          <span>
            Started <strong>{formatDateTime(detail.createdAt)}</strong>
          </span>
          <span>
            Duration{" "}
            <strong>
              {formatDuration(detail.createdAt, detail.completedAt)}
            </strong>
          </span>
          <span>
            Attempt <strong>#{detail.attempt}</strong>
          </span>
          <span>
            Updated <strong>{timeAgo(detail.updatedAt, now)}</strong>
          </span>
        </div>
        <div className="detail-actions">
          {workflowSignals.length > 0 || waitingSignals.length > 0 ? (
            <button
              type="button"
              className="btn primary"
              disabled={!live}
              onClick={() => onSignal(waitingSignals[0]?.wait?.signalId)}
              title={
                waitingSignals.length === 0
                  ? "Deliver or queue a signal"
                  : `Send ${waitingSignals[0]?.wait?.signalId}`
              }
            >
              Send signal
            </button>
          ) : null}
          {capabilities.command && workflowCommands.length > 0 && onCommand ? (
            <button
              type="button"
              className="btn ghost"
              disabled={!live}
              onClick={onCommand}
              title="Submit a tracked command to this execution"
            >
              Send command
            </button>
          ) : null}
          {canRetry ? (
            <button type="button" className="btn ghost" onClick={onRetry}>
              Retry
            </button>
          ) : null}
          {capabilities.pause &&
          live &&
          !paused &&
          detail.status !== "cancelling" ? (
            <button type="button" className="btn ghost" onClick={onPause}>
              Pause
            </button>
          ) : null}
          {capabilities.resume && paused ? (
            <button type="button" className="btn ghost" onClick={onResume}>
              Resume
            </button>
          ) : null}
          {capabilities.restart && canRestart ? (
            <button
              type="button"
              className="btn ghost"
              disabled={Boolean(detail.historyCollectedAt)}
              title={
                detail.historyCollectedAt
                  ? "Execution history was collected; start a fresh run with explicit input."
                  : undefined
              }
              onClick={onRestart}
            >
              Restart
            </button>
          ) : null}
          <details className="operator-menu">
            <summary className="btn ghost">Operate ▾</summary>
            <div className="operator-menu-popover">
              <button type="button" onClick={onSkip}>
                Skip step
              </button>
              <button type="button" onClick={onEdit}>
                Edit state
              </button>
              {capabilities.reset && onReset ? (
                <button
                  type="button"
                  disabled={!canReset}
                  onClick={() => onReset()}
                  title={
                    canReset
                      ? "Create a checkpoint branch before a completed top-level step"
                      : detail.historyCollectedAt
                      ? "History was collected"
                      : !detail.historyRecorded
                      ? "No ordered history recorded for this execution"
                      : live && !paused
                      ? "Pause the execution first"
                      : "No eligible top-level checkpoint boundary"
                  }
                >
                  Reset to checkpoint
                </button>
              ) : null}
              {capabilities.replay && onExportReplay ? (
                <button
                  type="button"
                  disabled={!canExportReplay}
                  onClick={onExportReplay}
                  title={
                    canExportReplay
                      ? "Download portable replay fixture JSON"
                      : "Replay export requires recorded, uncollected history"
                  }
                >
                  Export replay fixture
                </button>
              ) : null}
              <button type="button" onClick={onExport}>
                Export JSON
              </button>
              <span className="operator-menu-rule" />
              <button type="button" disabled={!live} onClick={onCancel}>
                Cancel execution
              </button>
              <button
                type="button"
                className="danger-text"
                disabled={!live}
                onClick={onForceFail}
              >
                Force fail
              </button>
            </div>
          </details>
        </div>
        {detail.error ? (
          <div className="error-banner">
            <strong>
              Failed{detail.error.stepId ? ` at ${detail.error.stepId}` : ""}:
            </strong>{" "}
            {detail.error.message}
          </div>
        ) : null}
      </header>

      <nav className="tabs" aria-label="Execution views">
        {(["timeline", "relations", "signals", "data", "audit"] as Tab[]).map(
          (name) => (
            <button
              key={name}
              type="button"
              className={`tab${tab === name ? " active" : ""}`}
              onClick={() => setTab(name)}
            >
              {name === "timeline"
                ? `Timeline · ${detail.timeline.length}`
                : null}
              {name === "relations"
                ? `Tree · ${detail.relations.children.length}`
                : null}
              {name === "signals"
                ? `Signals · ${detail.signals.reduce(
                    (total, journal) => total + journal.history.length,
                    0
                  )}`
                : null}
              {name === "data" ? "Data" : null}
              {name === "audit" ? `Audit · ${detail.audit.length}` : null}
            </button>
          )
        )}
      </nav>

      <div className="tab-body">
        {tab === "timeline" ? (
          detail.historyCollectedAt && detail.timeline.length === 0 ? (
            <div className="empty-list">
              <p className="empty-title">History collected</p>
              <p className="empty-sub">
                Completed step checkpoints and inputs were cleaned up under the
                retention policy. The completion receipt and result remain under
                Data.
              </p>
            </div>
          ) : (
            <Timeline
              nodes={detail.timeline}
              edges={detail.edges}
              now={now}
              onSignal={onSignal}
              canReset={Boolean(capabilities.reset && canReset && onReset)}
              onResetBeforeStep={
                onReset ? (stepId) => onReset(stepId) : undefined
              }
            />
          )
        ) : null}
        {tab === "relations" ? (
          <ExecutionRelations
            detail={detail}
            now={now}
            onOpen={onOpenExecution}
          />
        ) : null}
        {tab === "signals" ? <SignalHistory journals={detail.signals} /> : null}
        {tab === "data" ? (
          <div className="data-tab">
            <section>
              <h3>Input</h3>
              {detail.historyCollectedAt &&
              (detail.input === undefined || detail.input === null) ? (
                <p className="muted">
                  Input stripped when execution history was collected.
                </p>
              ) : (
                <JsonView value={detail.input} label="input" />
              )}
            </section>
            <section>
              <h3>Result</h3>
              {detail.result === null || detail.result === undefined ? (
                <p className="muted">
                  {live
                    ? "No result yet — the workflow is still running."
                    : "No result recorded."}
                </p>
              ) : (
                <JsonView value={detail.result} label="result" />
              )}
            </section>
            <section>
              <h3>Workflow state</h3>
              {detail.state === null ? (
                <p className="muted">
                  {capabilities.state
                    ? "No workflow state recorded."
                    : "Workflow state is unavailable in this Runner version."}
                </p>
              ) : (
                <>
                  <p className="muted">
                    Updated {formatDateTime(detail.state.updatedAt)}
                  </p>
                  <JsonView value={detail.state.state} label="state" />
                </>
              )}
            </section>
            {detail.retention || detail.historyCollectedAt ? (
              <section>
                <h3>Retention</h3>
                <div className="retention-grid">
                  <div>
                    <span className="retention-label">History</span>
                    <strong>
                      {formatRetentionLabel(detail.retention?.onComplete)}
                    </strong>
                    {detail.historyCollectedAt ? (
                      <em>
                        Collected {formatDateTime(detail.historyCollectedAt)}
                      </em>
                    ) : detail.retention?.historyCollectAt ? (
                      <em>
                        Eligible{" "}
                        {formatDateTime(detail.retention.historyCollectAt)}
                      </em>
                    ) : null}
                  </div>
                  <div>
                    <span className="retention-label">Receipts</span>
                    <strong>
                      {formatRetentionLabel(detail.retention?.receipts)}
                    </strong>
                    {detail.retention?.receiptExpireAt ? (
                      <em>
                        Expires{" "}
                        {formatDateTime(detail.retention.receiptExpireAt)}
                      </em>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}
            {detail.error?.stack ? (
              <section>
                <h3>Error stack</h3>
                <pre className="stack">{detail.error.stack}</pre>
              </section>
            ) : null}
            {workflow ? (
              <section>
                <h3>Workflow</h3>
                <p className="muted">{workflow.description}</p>
                <div className="workflow-meta-pills">
                  {detail.workflowVersion !== undefined ? (
                    <span className="version-badge">
                      Version v{detail.workflowVersion}
                    </span>
                  ) : null}
                  {workflow.concurrency ? (
                    <span className="micro-badge">
                      Concurrency: {workflow.concurrency}
                    </span>
                  ) : null}
                  {workflowCommands.map((cmd) => (
                    <span key={cmd.taskKey} className="micro-badge">
                      Command: {cmd.title}
                    </span>
                  ))}
                </div>
                {workflow.taskId ? (
                  <a
                    href={`/docs#element-${encodeURIComponent(
                      workflow.taskId
                    )}`}
                  >
                    Open workflow documentation
                  </a>
                ) : null}
              </section>
            ) : null}
          </div>
        ) : null}
        {tab === "audit" ? (
          <ol className="audit-list">
            {detail.audit.length === 0 ? (
              <p className="muted">No audit entries recorded.</p>
            ) : null}
            {[...detail.audit].reverse().map((entry) => (
              <li key={entry.id} className="audit-row">
                <div className="audit-top">
                  <span className="audit-kind">
                    {AUDIT_LABELS[entry.kind] ?? entry.kind}
                  </span>
                  <span className="audit-time">{formatDateTime(entry.at)}</span>
                </div>
                <JsonView value={entry.detail} collapsed label="detail" />
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </fieldset>
  );
}

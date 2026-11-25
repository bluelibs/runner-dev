import { useMemo, useState } from "react";
import type { StudioExecutionDetail } from "../../../../durable/shared/types";
import { Modal } from "./Modal";

export function ResetDialog({
  detail,
  initialStepId,
  busy,
  onReset,
  onClose,
}: {
  detail: StudioExecutionDetail;
  initialStepId?: string;
  busy: boolean;
  onReset: (
    beforeStep: string,
    reason: string,
    idempotencyKey?: string
  ) => void;
  onClose: () => void;
}) {
  const steps = detail.resettableSteps ?? [];
  const defaultStep =
    initialStepId && steps.includes(initialStepId)
      ? initialStepId
      : steps[0] ?? "";
  const [beforeStep, setBeforeStep] = useState(defaultStep);
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const priorCountByStep = useMemo(() => {
    const counts = new Map<string, number>();
    const history = detail.history ?? [];
    for (const stepId of steps) {
      const boundary = history.find((entry) => entry.stepId === stepId);
      if (!boundary) continue;
      const kept = history.filter(
        (entry) =>
          entry.kind !== "origin" && entry.startedOrder < boundary.startedOrder
      ).length;
      counts.set(stepId, kept);
    }
    return counts;
  }, [detail.history, steps]);

  return (
    <Modal
      title="Reset to checkpoint"
      subtitle="Create a new branch execution keeping completed steps before the selected boundary. The source execution stays unchanged."
      onClose={onClose}
    >
      <label className="field">
        <span className="field-label">Re-run starting at step</span>
        <select
          className="select"
          value={beforeStep}
          onChange={(event) => setBeforeStep(event.target.value)}
        >
          {steps.map((stepId) => {
            const kept = priorCountByStep.get(stepId);
            return (
              <option key={stepId} value={stepId}>
                {stepId}
                {kept !== undefined
                  ? ` (keeps ${kept} prior operation${kept === 1 ? "" : "s"})`
                  : ""}
              </option>
            );
          })}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Reason</span>
        <input
          className="text-input"
          value={reason}
          autoFocus
          placeholder="Why is this checkpoint branch being created?"
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">Idempotency key (optional)</span>
        <input
          className="text-input"
          value={idempotencyKey}
          placeholder="reset-request-123"
          onChange={(event) => setIdempotencyKey(event.target.value)}
        />
      </label>
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={busy || beforeStep === "" || reason.trim() === ""}
          onClick={() =>
            onReset(
              beforeStep,
              reason.trim(),
              idempotencyKey.trim() || undefined
            )
          }
        >
          {busy ? "Branching…" : "Create branch"}
        </button>
      </div>
    </Modal>
  );
}

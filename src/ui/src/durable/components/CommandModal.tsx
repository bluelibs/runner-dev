import { useState } from "react";
import type { StudioCommand } from "../../../../durable/shared/types";
import { JsonEditor, Modal } from "./Modal";

export function CommandModal({
  commands,
  busy,
  onSend,
  onClose,
}: {
  commands: StudioCommand[];
  busy: boolean;
  onSend: (command: string, input: unknown, idempotencyKey?: string) => void;
  onClose: () => void;
}) {
  const first = commands[0];
  const [taskKey, setTaskKey] = useState(first?.taskKey ?? "");
  const command = commands.find((item) => item.taskKey === taskKey) ?? first;
  const [text, setText] = useState("{}");
  const [parsed, setParsed] = useState<unknown>({});
  const [valid, setValid] = useState(true);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  if (!first || !command) return null;

  return (
    <Modal
      title="Send command"
      subtitle="Submit a tracked command serialized under execution ownership."
      onClose={onClose}
      busy={busy}
    >
      <label className="field">
        <span className="field-label">Command</span>
        <select
          className="select"
          value={taskKey}
          onChange={(event) => setTaskKey(event.target.value)}
        >
          {commands.map((item) => (
            <option key={item.taskKey} value={item.taskKey}>
              {item.title} · {item.taskKey}
            </option>
          ))}
        </select>
      </label>
      {command.description ? (
        <p className="field-hint">{command.description}</p>
      ) : null}
      <div className="field">
        <span className="field-label">Input</span>
        <JsonEditor
          presets={[]}
          value={text}
          validationMessage="Checked against this command task's input schema before persisting."
          onChange={(next, nextParsed, nextValid) => {
            setText(next);
            setParsed(nextParsed);
            setValid(nextValid);
          }}
        />
      </div>
      <label className="field">
        <span className="field-label">Idempotency key (optional)</span>
        <input
          className="text-input"
          value={idempotencyKey}
          placeholder="cmd-request-123"
          onChange={(event) => setIdempotencyKey(event.target.value)}
        />
      </label>
      <div className="modal-actions">
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!valid || busy || taskKey === ""}
          onClick={() =>
            onSend(taskKey, parsed, idempotencyKey.trim() || undefined)
          }
        >
          {busy ? "Sending…" : "Send command"}
        </button>
      </div>
    </Modal>
  );
}

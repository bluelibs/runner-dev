import { useContext, useEffect, useState } from "react";
import { WorkflowApiContext } from "../workflowFeed";
import type { StudioWorkflow } from "../../../../durable/shared/types";
import { JsonEditor, Modal } from "./Modal";
import { WorkflowSelect } from "./WorkflowSelect";

export function StartModal({
  workflows,
  initialWorkflow,
  busy,
  onStart,
  onClose,
}: {
  workflows: StudioWorkflow[];
  initialWorkflow: string | null;
  busy: boolean;
  onStart: (workflow: string, input: unknown, version?: number | null) => void;
  onClose: () => void;
}) {
  const first =
    workflows.find((w) => w.key === initialWorkflow) ?? workflows[0];
  const [workflowKey, setWorkflowKey] = useState(first?.key ?? "");
  const [workflow, setWorkflow] = useState(first);
  const [selectedVersion, setSelectedVersion] = useState<
    number | null | undefined
  >(() =>
    first?.versions && first.versions.length > 1
      ? first.versions[0].version
      : first?.version
  );
  const activeVersion = workflow?.versions?.find(
    (entry) => entry.version === (selectedVersion ?? null)
  );
  const initialPresets = activeVersion?.presets ?? workflow?.presets ?? [];
  const [text, setText] = useState(
    JSON.stringify(initialPresets[0]?.payload ?? {}, null, 2)
  );
  const [parsed, setParsed] = useState<unknown>(
    initialPresets[0]?.payload ?? {}
  );
  const [valid, setValid] = useState(true);
  const api = useContext(WorkflowApiContext);
  const [loading, setLoading] = useState(
    Boolean(initialWorkflow && first?.key !== initialWorkflow)
  );
  const [error, setError] = useState("");
  useEffect(() => {
    if (!api || !initialWorkflow || first?.key === initialWorkflow) return;
    let active = true;
    void api
      .getWorkflow(initialWorkflow)
      .then((next) => {
        if (!active) return;
        pickWorkflow(next.key, next);
        setLoading(false);
      })
      .catch((failure: unknown) => {
        if (active)
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not load workflow."
          );
      });
    return () => {
      active = false;
    };
  }, [api, initialWorkflow]);

  if (!first || !workflow) return null;

  const versions = workflow.versions ?? [];
  const hasMultipleVersions = versions.length > 1;
  const presets = activeVersion?.presets ?? workflow.presets;
  const description = activeVersion?.description ?? workflow.description;

  function applyVersion(
    nextWorkflow: StudioWorkflow,
    version: number | null | undefined
  ) {
    setSelectedVersion(version);
    const matched = nextWorkflow.versions?.find(
      (entry) => entry.version === (version ?? null)
    );
    const nextPresets = matched?.presets ?? nextWorkflow.presets;
    const payload = JSON.stringify(nextPresets[0]?.payload ?? {}, null, 2);
    setText(payload);
    setParsed(nextPresets[0]?.payload ?? {});
    setValid(true);
  }

  function pickWorkflow(key: string, next: StudioWorkflow) {
    setWorkflowKey(key);
    setWorkflow(next);
    const nextVersion =
      next.versions && next.versions.length > 1
        ? next.versions[0].version
        : next.version;
    applyVersion(next, nextVersion);
  }

  return (
    <Modal
      title="Start execution"
      subtitle="Pick a workflow and shape its input."
      onClose={onClose}
    >
      <div className="field">
        <span className="field-label">
          Workflow{" "}
          {!hasMultipleVersions && workflow.version !== undefined ? (
            <span className="version-badge">v{workflow.version}</span>
          ) : null}
        </span>
        <WorkflowSelect
          workflows={
            workflows.some((item) => item.key === workflow.key)
              ? workflows
              : [workflow, ...workflows]
          }
          value={workflowKey}
          onChange={pickWorkflow}
        />
      </div>
      {hasMultipleVersions ? (
        <label className="field">
          <span className="field-label">Version</span>
          <select
            className="select"
            value={
              selectedVersion === null
                ? "unversioned"
                : String(selectedVersion ?? "")
            }
            onChange={(event) => {
              const raw = event.target.value;
              const nextVersion = raw === "unversioned" ? null : Number(raw);
              applyVersion(workflow, nextVersion);
            }}
          >
            {versions.map((entry, index) => (
              <option
                key={entry.version === null ? "unversioned" : entry.version}
                value={
                  entry.version === null ? "unversioned" : String(entry.version)
                }
              >
                {entry.version === null
                  ? "Unversioned (legacy)"
                  : index === 0
                  ? `v${entry.version} (latest)`
                  : `v${entry.version}`}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p className="field-hint">{description}</p>
      {error ? <p role="alert">{error}</p> : null}
      <div className="field">
        <span className="field-label">Input</span>
        <JsonEditor
          key={`${workflowKey}:${selectedVersion ?? "unversioned"}`}
          presets={presets}
          value={text}
          validationMessage="Checked against this workflow's runtime input schema before a run is created."
          onChange={(next, nextParsed, nextValid) => {
            setText(next);
            setParsed(nextParsed);
            setValid(nextValid);
          }}
        />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!valid || busy || loading}
          onClick={() =>
            onStart(
              workflowKey,
              parsed,
              hasMultipleVersions || workflow.version !== undefined
                ? selectedVersion
                : undefined
            )
          }
        >
          {busy ? "Starting…" : "Start execution"}
        </button>
      </div>
    </Modal>
  );
}

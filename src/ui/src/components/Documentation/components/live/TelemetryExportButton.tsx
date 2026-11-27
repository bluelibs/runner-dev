import React, { useState } from "react";

export function TelemetryExportButton({
  label,
  onExport,
  disabled = false,
}: {
  label: string;
  disabled?: boolean;
  onExport: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="issue-action"
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onExport();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Export failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Exporting…" : label}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}

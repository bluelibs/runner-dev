import { useEffect, useState } from "react";
import type { StudioExecutionDetail } from "../../../durable/shared/types";
import type { StudioApi } from "./api";

export function useExecutionDetail(api: StudioApi, selectedId: string | null) {
  const [detail, setDetail] = useState<StudioExecutionDetail | null>(null);
  const [failure, setFailure] = useState<{
    id: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setFailure(null);
      return;
    }
    let active = true;
    setFailure(null);
    // Keep the inspected view mounted until the next selection has real data.
    const unsubscribe = api.subscribeExecution(
      selectedId,
      (next) => {
        if (!active) return;
        setDetail(next);
        setFailure(null);
      },
      (error) => {
        if (!active) return;
        setFailure({
          id: selectedId,
          message:
            error instanceof Error
              ? error.message
              : "Could not load execution.",
        });
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [api, selectedId]);

  const error = failure?.id === selectedId ? failure.message : "";
  const switching = Boolean(selectedId && detail?.id !== selectedId);
  return {
    detail: selectedId ? detail : null,
    error,
    switching,
    loading: switching && !error,
  };
}

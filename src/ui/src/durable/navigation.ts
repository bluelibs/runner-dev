import { useCallback, useEffect, useState } from "react";
import type { StudioView } from "./components/Sidebar";
import type { DashboardStatusFilter } from "./dashboard";

interface StudioLocation {
  view: StudioView;
  selectedId: string | null;
  workflowFilter: string | null;
  statusFilter: DashboardStatusFilter;
  query: string;
  modal: "start" | "signal" | null;
}
const statuses: DashboardStatusFilter[] = [
  "all",
  "live",
  "sleeping",
  "paused",
  "failed",
  "completed",
  "cancelled",
];
function readLocation(): StudioLocation {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  const requestedStatus = params.get("status");
  const modal = params.get("modal");
  return {
    view:
      requestedView === "catalog" ||
      requestedView === "overview" ||
      requestedView === "schedules" ||
      requestedView === "executions"
        ? requestedView
        : params.has("select") || modal
        ? "executions"
        : "overview",
    selectedId: params.get("select"),
    workflowFilter: params.get("workflow"),
    statusFilter:
      statuses.find((status) => status === requestedStatus) ?? "all",
    query: params.get("query") ?? "",
    modal: modal === "start" || modal === "signal" ? modal : null,
  };
}

/** URL changes happen with the user action, so Back never creates another entry. */
export function useStudioNavigation() {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const restore = () => setLocation(readLocation());
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const navigate = useCallback(
    (patch: Partial<StudioLocation>, replace = false) => {
      const next = { ...readLocation(), ...patch };
      const url = new URL(window.location.href);
      const values = {
        view: next.view,
        select: next.selectedId,
        workflow: next.workflowFilter,
        status: next.statusFilter === "all" ? null : next.statusFilter,
        query: next.query || null,
        modal: next.modal,
      };
      for (const [key, value] of Object.entries(values)) {
        if (value === null) url.searchParams.delete(key);
        else url.searchParams.set(key, value);
      }
      if (url.href !== window.location.href) {
        if (replace) window.history.replaceState(null, "", url);
        else window.history.pushState(null, "", url);
      }
      setLocation(next);
    },
    []
  );
  return { ...location, navigate };
}

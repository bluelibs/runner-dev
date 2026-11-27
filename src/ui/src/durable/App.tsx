import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  StudioExecutionDetail,
  StudioExecutionSummary,
  StudioSchedule,
  StudioWorkflow,
} from "../../../durable/shared/types";
import {
  EXECUTION_STATUS_META,
  isLiveStatus,
} from "../../../durable/shared/statuses";
import { ApiError, type StudioApi } from "./api";
import type { DurableRuntimeDescriptor } from "../../../durable/shared/runtime";
import { useExecutionFeed } from "./executionFeed";
import { useExecutionDetail } from "./useExecutionDetail";
import { WorkflowApiContext } from "./workflowFeed";
import type { DashboardStatusFilter } from "./dashboard";
import { usePollingFeed } from "./usePollingFeed";
import { useStudioNavigation } from "./navigation";
import { FeedNotices, type FeedNoticeState } from "./components/FeedNotice";
import { CommandModal } from "./components/CommandModal";
import { ExecutionDetail } from "./components/ExecutionDetail";
import { ExecutionList } from "./components/ExecutionList";
import { ConfirmDialog, Modal, ReasonDialog } from "./components/Modal";
import { Overview } from "./components/Overview";
import {
  OperatorDialog,
  type OperatorAction,
} from "./components/OperatorDialog";
import { ResetDialog } from "./components/ResetDialog";
import { Schedules } from "./components/Schedules";
import { Sidebar, type StudioView } from "./components/Sidebar";
import { SignalModal } from "./components/SignalModal";
import { StartModal } from "./components/StartModal";
import { Toasts, type Toast } from "./components/Toasts";

type StatusFilter = DashboardStatusFilter;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "sleeping", label: "Sleeping" },
  { id: "paused", label: "Paused" },
  { id: "failed", label: "Failed" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

export function App({
  api,
  runtime,
}: {
  api: StudioApi;
  runtime: DurableRuntimeDescriptor;
}) {
  const {
    view,
    selectedId,
    workflowFilter,
    statusFilter,
    query,
    modal,
    navigate,
  } = useStudioNavigation();
  const setView = (view: StudioView) => navigate({ view, modal: null });
  const setSelectedId = (selectedId: string | null) => navigate({ selectedId });
  const setWorkflowFilter = (workflowFilter: string | null) =>
    navigate({ workflowFilter });
  const setStatusFilter = (statusFilter: StatusFilter) =>
    navigate({ statusFilter });
  const setQuery = (query: string) => navigate({ query }, true);
  const starting = modal === "start";
  const signalling = modal === "signal";
  const setStarting = (open: boolean) =>
    navigate({ modal: open ? "start" : null });
  const setSignalling = (open: boolean) =>
    navigate({ modal: open ? "signal" : null });
  const [workflows, setWorkflows] = useState<StudioWorkflow[]>([]);
  const {
    detail,
    error: detailError,
    switching: switchingExecution,
    loading: loadingDetail,
    refresh: refreshDetail,
  } = useExecutionDetail(api, selectedId);
  const [commanding, setCommanding] = useState(false);
  const [resettingStep, setResettingStep] = useState<string | null>(null);
  const [signalPreset, setSignalPreset] = useState<string | undefined>(
    undefined
  );
  const [confirming, setConfirming] = useState<
    "cancel" | "retry" | "restart" | "force-fail" | null
  >(null);
  const [operatorAction, setOperatorAction] = useState<OperatorAction | null>(
    null
  );
  useEffect(() => {
    setConfirming(null);
    setOperatorAction(null);
    setCommanding(false);
    setResettingStep(null);
  }, [selectedId, modal]);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  useEffect(() => setModalError(""), [modal]);
  const [recovering, setRecovering] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unauthorized, setUnauthorized] = useState(false);
  const actionPending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const ownsRuntime = () =>
    mounted.current &&
    (new URLSearchParams(window.location.search).get("runtimeId") ??
      runtime.id) === runtime.id;
  const [now, setNow] = useState(() => Date.now());
  const searchRef = useRef<HTMLInputElement>(null);
  const overviewSearchRef = useRef<HTMLInputElement>(null);
  const toastSequence = useRef(0);

  const pushToast = useCallback((kind: Toast["kind"], message: string) => {
    toastSequence.current += 1;
    const id = toastSequence.current;
    setToasts((current) => [...current.slice(-3), { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const noteUnauthorized = useCallback((error: unknown): boolean => {
    if (error instanceof ApiError && error.status === 401) {
      setUnauthorized(true);
      return true;
    }
    return false;
  }, []);
  const executionFeed = useExecutionFeed({
    api,
    paused: view === "schedules",
    onError: noteUnauthorized,
    workflowKey: workflowFilter ?? undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    executionId: query.trim() || undefined,
  });
  const executions = executionFeed.executions;
  useEffect(() => {
    let active = true;
    const keys = [
      ...new Set(
        [workflowFilter, detail?.workflowKey].filter((key): key is string =>
          Boolean(key)
        )
      ),
    ];
    void Promise.all(keys.map((key) => api.getWorkflow(key)))
      .then((selected) => {
        if (active)
          setWorkflows((current) => [
            ...current.slice(0, 20).filter((item) => !keys.includes(item.key)),
            ...selected,
          ]);
      })
      .catch((error: unknown) => {
        if (active)
          pushToast(
            "error",
            error instanceof Error
              ? error.message
              : "Could not load workflow metadata."
          );
      });
    return () => {
      active = false;
    };
  }, [api, workflowFilter, detail?.workflowKey, pushToast]);

  const loadCatalog = useCallback(
    async () => (await api.listWorkflowPage()).workflows,
    [api]
  );
  const loadSchedules = useCallback(() => api.listSchedules(), [api]);
  const loadStuck = useCallback(() => api.listStuck(), [api]);
  const catalog = usePollingFeed(loadCatalog, [], true, noteUnauthorized, null);
  const scheduleFeed = usePollingFeed<StudioSchedule[]>(
    loadSchedules,
    [],
    view !== "executions",
    noteUnauthorized
  );
  const stuckFeed = usePollingFeed<StudioExecutionSummary[]>(
    loadStuck,
    [],
    view === "overview",
    noteUnauthorized
  );
  const schedules = scheduleFeed.data;
  const stuck = stuckFeed.data;
  useEffect(() => {
    setWorkflows((current) => [
      ...catalog.data,
      ...current.filter(
        (item) => !catalog.data.some((next) => next.key === item.key)
      ),
    ]);
  }, [catalog.data]);

  const refreshLists = async () => {
    await Promise.all([
      executionFeed.refreshHead(),
      scheduleFeed.refresh(),
      stuckFeed.refresh(),
    ]);
  };
  const previewSchedule = useCallback(
    (body: Record<string, unknown>) => api.previewSchedule(body),
    [api]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (
        unauthorized ||
        event.defaultPrevented ||
        document.querySelector('[aria-modal="true"]')
      )
        return;
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";
      if (typing || target?.isContentEditable) return;
      if (event.key === "/") {
        event.preventDefault();
        if (view === "overview") overviewSearchRef.current?.focus();
        else searchRef.current?.focus();
      } else if (event.key === "n") {
        navigate({ modal: "start" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, navigate, unauthorized]);

  const counts = useMemo(
    () => ({
      total: executions.length,
      live: executions.filter((e) => isLiveStatus(e.status)).length,
      failed: executions.filter((e) => e.status === "failed").length,
    }),
    [executions]
  );

  // A ref closes the gap before React renders the pending state.
  async function mutate<T>(fn: () => Promise<T>): Promise<T> {
    if (actionPending.current)
      throw new Error("Another operation is still pending.");
    actionPending.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      actionPending.current = false;
      if (ownsRuntime()) setBusy(false);
    }
  }

  async function act(label: string, fn: () => Promise<void>) {
    if (actionPending.current) return;
    try {
      await mutate(fn);
      if (!ownsRuntime()) return;
      refreshDetail();
      void refreshLists();
    } catch (error) {
      if (!ownsRuntime()) return;
      if (!noteUnauthorized(error))
        pushToast(
          "error",
          `${label}: ${
            error instanceof Error ? error.message : "Operation failed."
          }`
        );
    }
  }

  async function saveSchedule(fn: () => Promise<unknown>, message: string) {
    try {
      await mutate(fn);
    } catch (error) {
      noteUnauthorized(error);
      throw error;
    }
    if (!ownsRuntime()) return;
    pushToast("success", message);
    // Read failures belong to their feeds; the write already succeeded.
    void refreshLists();
  }

  async function startWorkflow(
    workflow: string,
    input: unknown,
    version?: number | null
  ) {
    if (actionPending.current) return;
    setModalError("");
    try {
      const executionId = await mutate(() =>
        version === undefined
          ? api.startExecution(workflow, input)
          : api.startExecution(workflow, input, version)
      );
      if (!ownsRuntime()) return;
      navigate({
        modal: null,
        view: "executions",
        workflowFilter: null,
        statusFilter: "all",
        query: "",
        selectedId: executionId,
      });
      pushToast("success", `Started ${truncateMiddle(executionId)}.`);
      void refreshLists();
    } catch (error) {
      if (!ownsRuntime()) return;
      if (!noteUnauthorized(error))
        setModalError(
          error instanceof Error ? error.message : "Failed to start."
        );
    }
  }

  function ownsSelection(id: string) {
    return (
      ownsRuntime() &&
      new URLSearchParams(window.location.search).get("select") === id
    );
  }

  async function sendSignal(signal: string, payload: unknown) {
    if (
      !selectedId ||
      actionPending.current ||
      switchingExecution ||
      detail?.id !== selectedId
    )
      return;
    const targetId = selectedId;
    setModalError("");
    try {
      await mutate(() => api.sendSignal(targetId, signal, payload));
      if (!ownsSelection(targetId)) return;
      setSignalling(false);
      pushToast("success", `Delivered ${signal}.`);
      refreshDetail();
    } catch (error) {
      if (!ownsSelection(targetId)) return;
      if (!noteUnauthorized(error))
        setModalError(
          error instanceof Error ? error.message : "Failed to signal."
        );
    }
  }

  async function sendCommand(
    command: string,
    input: unknown,
    idempotencyKey?: string
  ) {
    if (!selectedId || detail?.id !== selectedId || actionPending.current)
      return;
    try {
      const outcome = await mutate(() =>
        api.sendCommand(selectedId, command, input, {
          ...(idempotencyKey ? { idempotencyKey } : {}),
        })
      );
      if (!ownsSelection(selectedId)) return;
      setCommanding(false);
      pushToast(
        outcome.completed ? "success" : "info",
        outcome.completed
          ? `Command ${command} completed.`
          : outcome.message ?? `Command ${command} queued.`
      );
      refreshDetail();
      void refreshLists();
    } catch (error) {
      if (ownsSelection(selectedId) && !noteUnauthorized(error)) {
        pushToast(
          "error",
          error instanceof ApiError ? error.message : "Failed to send command."
        );
      }
    }
  }

  async function resetExecution(
    beforeStep: string,
    reason: string,
    idempotencyKey?: string
  ) {
    if (!selectedId || detail?.id !== selectedId || actionPending.current)
      return;
    try {
      const branchId = await mutate(() =>
        api.resetExecution(selectedId, beforeStep, reason, idempotencyKey)
      );
      if (!ownsSelection(selectedId)) return;
      setResettingStep(null);
      setSelectedId(branchId);
      pushToast("success", `Branched as ${truncateMiddle(branchId)}.`);
      void refreshLists();
    } catch (error) {
      if (ownsSelection(selectedId) && !noteUnauthorized(error)) {
        pushToast(
          "error",
          error instanceof ApiError ? error.message : "Failed to reset."
        );
      }
    }
  }

  async function exportReplayFixture(detailToExport: StudioExecutionDetail) {
    if (actionPending.current) return;
    try {
      const fixture = await mutate(() => api.exportReplay(detailToExport.id));
      if (!ownsSelection(detailToExport.id)) return;
      const payload = JSON.stringify(fixture, null, 2);
      const url = URL.createObjectURL(
        new Blob([payload], { type: "application/json" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${detailToExport.workflowKey}-${detailToExport.id}-replay.json`;
      link.click();
      URL.revokeObjectURL(url);
      pushToast("success", "Replay fixture exported.");
    } catch (error) {
      if (ownsSelection(detailToExport.id) && !noteUnauthorized(error)) {
        pushToast(
          "error",
          error instanceof ApiError
            ? error.message
            : "Failed to export replay fixture."
        );
      }
    }
  }

  async function restartExecution(id: string) {
    if (actionPending.current) return;
    try {
      const nextId = await mutate(() => api.restartExecution(id));
      if (!ownsRuntime()) return;
      navigate({ selectedId: nextId, modal: null });
      pushToast("success", `Restarted as ${truncateMiddle(nextId)}.`);
      void refreshLists();
    } catch (error) {
      if (!ownsRuntime()) return;
      if (!noteUnauthorized(error))
        pushToast(
          "error",
          error instanceof Error ? error.message : "Failed to restart."
        );
    }
  }

  function exportExecution(detailToExport: StudioExecutionDetail) {
    const payload = JSON.stringify(detailToExport, null, 2);
    const url = URL.createObjectURL(
      new Blob([payload], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${detailToExport.workflowKey}-${detailToExport.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast("success", "Execution JSON exported.");
  }

  const selectedWorkflow = workflows.find(
    (workflow) => workflow.key === detail?.workflowKey
  );
  const selectedWorkflowVersion = selectedWorkflow?.versions?.find(
    (entry) => entry.version === (detail?.workflowVersion ?? null)
  );
  const configuredSignals =
    selectedWorkflowVersion?.signals ?? selectedWorkflow?.signals ?? [];
  const detailCommands =
    selectedWorkflowVersion?.commands ?? selectedWorkflow?.commands ?? [];
  const waitingSignalId = detail?.timeline.find(
    (node) => node.state === "waiting" && node.wait?.signalId
  )?.wait?.signalId;
  // Signals metadata is optional; an observed wait still provides its actual event ID.
  const detailSignals = configuredSignals.length
    ? configuredSignals
    : waitingSignalId
    ? [
        {
          id: waitingSignalId,
          title: waitingSignalId,
          description: "This execution is waiting for this registered event.",
          presets: [],
        },
      ]
    : [];

  if (unauthorized) {
    return (
      <div className="offline">
        <h1>Authentication required</h1>
        <p>
          Your session for {runtime.title} needs authentication. Sign in to
          Runner Dev and retry.
        </p>
        <button
          className="btn primary"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
        <a className="btn ghost" href="/docs">
          Back to documentation
        </a>
      </div>
    );
  }

  const visibleFeeds: FeedNoticeState[] = [
    { label: "Workflow catalog", ...catalog, onRetry: catalog.refresh },
    ...(view !== "executions"
      ? [{ label: "Schedules", ...scheduleFeed, onRetry: scheduleFeed.refresh }]
      : []),
    ...(view === "overview"
      ? [
          {
            label: "Stuck executions",
            ...stuckFeed,
            onRetry: stuckFeed.refresh,
          },
        ]
      : []),
    ...(view !== "schedules"
      ? [
          {
            label: "Executions",
            ...executionFeed,
            onRetry: executionFeed.retry,
          },
        ]
      : []),
  ];

  return (
    <WorkflowApiContext.Provider value={api}>
      <div className="studio">
        <div className="studio-notices">
          <FeedNotices feeds={visibleFeeds} now={now} />
        </div>
        <Sidebar
          workflows={workflows}
          view={view}
          onView={setView}
          workflowFilter={workflowFilter}
          onWorkflowFilter={setWorkflowFilter}
          counts={counts}
          totalExecutionCount={executionFeed.totalCount ?? undefined}
          hasMoreExecutions={executionFeed.hasMore}
          stuckCount={stuck.length}
          stuckAvailable={stuckFeed.updatedAt !== null && !stuckFeed.error}
          onRecover={() =>
            act("Recover", async () => {
              setRecovering(true);
              try {
                const report = await api.recover();
                pushToast(
                  "info",
                  `Recovery scanned ${report.scannedCount}, resumed ${report.recoveredCount}.`
                );
              } finally {
                setRecovering(false);
              }
            })
          }
          recovering={recovering || busy}
        />

        {view === "overview" ? (
          <main className="overview-pane">
            <Overview
              supportsPause={runtime.capabilities.pause}
              queryValue={query}
              onQueryChange={setQuery}
              statusValue={statusFilter}
              onStatusChange={setStatusFilter}
              executions={executions}
              schedules={schedules}
              stuck={stuck}
              workflows={workflows}
              workflowFilter={workflowFilter}
              onWorkflowFilter={setWorkflowFilter}
              onOpenExecution={(executionId) => {
                navigate({ selectedId: executionId, view: "executions" });
              }}
              onStart={() => setStarting(true)}
              searchRef={overviewSearchRef}
              refreshedAt={executionFeed.updatedAt}
              loading={executionFeed.loading}
              error={executionFeed.error}
              schedulesAvailable={
                scheduleFeed.updatedAt !== null && !scheduleFeed.error
              }
              stuckAvailable={stuckFeed.updatedAt !== null && !stuckFeed.error}
              onBrowse={() => navigate({ view: "executions" })}
              now={now}
              totalExecutionCount={executionFeed.totalCount ?? undefined}
              hasMoreExecutions={executionFeed.hasMore}
            />
          </main>
        ) : view === "schedules" ? (
          <main className="schedules-pane">
            <Schedules
              schedules={schedules}
              workflows={workflows}
              busy={busy}
              dialogsAllowed={!modal}
              loading={scheduleFeed.loading}
              available={scheduleFeed.updatedAt !== null}
              now={now}
              onCreate={(body) =>
                saveSchedule(
                  () => api.createSchedule(body),
                  "Schedule created."
                )
              }
              onUpdate={(id, body) =>
                saveSchedule(
                  () => api.updateSchedule(id, body),
                  "Schedule updated."
                )
              }
              onPreview={previewSchedule}
              onPause={(id) => act("Pause", () => api.pauseSchedule(id))}
              onResume={(id) => act("Resume", () => api.resumeSchedule(id))}
              onRemove={(id) =>
                act("Delete", async () => {
                  await api.removeSchedule(id);
                  pushToast("success", "Schedule deleted.");
                })
              }
            />
          </main>
        ) : (
          <>
            <section className="list-pane" aria-label="Executions">
              <div className="list-head">
                <input
                  ref={searchRef}
                  className="search-input"
                  placeholder="Execution ID (exact)…  ( / )"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <button
                  type="button"
                  className="btn primary small"
                  disabled={workflows.length === 0}
                  onClick={() => setStarting(true)}
                  title="New execution ( n )"
                >
                  + New
                </button>
              </div>
              <div
                className="filter-row"
                role="tablist"
                aria-label="Status filter"
              >
                {STATUS_FILTERS.filter(
                  (filter) =>
                    filter.id !== "paused" || runtime.capabilities.pause
                ).map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === filter.id}
                    className={`chip-btn${
                      statusFilter === filter.id ? " active" : ""
                    }`}
                    onClick={() => setStatusFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <ExecutionList
                key={`${workflowFilter}:${statusFilter}:${query}`}
                executions={executions}
                selectedId={selectedId}
                onSelect={setSelectedId}
                now={now}
                hasMore={executionFeed.hasMore}
                loading={executionFeed.loading}
                loadingMore={executionFeed.loadingMore}
                onLoadMore={executionFeed.loadMore}
                startOffset={executionFeed.startOffset}
                hasPrevious={executionFeed.hasPrevious}
                onLoadPrevious={executionFeed.loadPrevious}
                error={executionFeed.error}
                showErrorNotice={false}
                loadedCount={executions.length}
                filtered={
                  query.trim() !== "" ||
                  workflowFilter !== null ||
                  statusFilter !== "all"
                }
              />
            </section>
            <main className="detail-pane" aria-busy={loadingDetail}>
              {loadingDetail ? (
                <p className="detail-loading" role="status">
                  Loading execution…
                </p>
              ) : null}
              {detailError ? (
                <p className="error-banner" role="alert">
                  {detailError}
                </p>
              ) : null}
              {detail ? (
                <ExecutionDetail
                  disabled={switchingExecution}
                  busy={busy}
                  capabilities={runtime.capabilities}
                  detail={detail}
                  workflow={selectedWorkflow}
                  now={now}
                  onSignal={(signalId) => {
                    setSignalPreset(signalId);
                    setSignalling(true);
                  }}
                  onCommand={() => setCommanding(true)}
                  onCancel={() => setConfirming("cancel")}
                  onRetry={() => setConfirming("retry")}
                  onPause={() =>
                    selectedId &&
                    void act("Pause", () => api.pauseExecution(selectedId))
                  }
                  onResume={() =>
                    selectedId &&
                    void act("Resume", () => api.resumeExecution(selectedId))
                  }
                  onRestart={() => setConfirming("restart")}
                  onReset={(beforeStep) => setResettingStep(beforeStep ?? "")}
                  onExportReplay={() => void exportReplayFixture(detail)}
                  onForceFail={() => setConfirming("force-fail")}
                  onSkip={() => setOperatorAction("skip")}
                  onEdit={() => setOperatorAction("edit")}
                  onExport={() => exportExecution(detail)}
                  onOpenExecution={setSelectedId}
                />
              ) : !selectedId ? (
                <div className="empty-detail">
                  <p className="empty-title">Select an execution</p>
                  <p className="empty-sub">
                    Watch steps complete, signals arrive and branches resolve —
                    live.
                  </p>
                  <div className="empty-meta">
                    {Object.entries(EXECUTION_STATUS_META).map(
                      ([status, meta]) => (
                        <span key={status} className={`tag tone-${meta.tone}`}>
                          {meta.label}
                        </span>
                      )
                    )}
                  </div>
                </div>
              ) : null}
            </main>
          </>
        )}

        {starting && workflows.length > 0 ? (
          <StartModal
            workflows={workflows}
            initialWorkflow={workflowFilter}
            operationError={modalError}
            busy={busy}
            onStart={startWorkflow}
            onClose={() => setStarting(false)}
          />
        ) : null}
        {signalling && selectedId ? (
          switchingExecution || !detail || detail.id !== selectedId ? (
            <Modal
              title="Send signal"
              subtitle="Loading the selected execution"
              onClose={() => setSignalling(false)}
            >
              <p role={detailError ? "alert" : "status"}>
                {detailError || "Loading execution…"}
              </p>
            </Modal>
          ) : detailSignals.length > 0 ? (
            <SignalModal
              key={selectedId}
              signals={detailSignals}
              error={modalError}
              initialSignal={signalPreset ?? waitingSignalId}
              busy={busy}
              onSend={sendSignal}
              onClose={() => setSignalling(false)}
            />
          ) : (
            <Modal
              title="Send signal"
              subtitle="Deliver an event to the waiting execution."
              onClose={() => setSignalling(false)}
            >
              <p className="confirm-message">
                {selectedWorkflow
                  ? "This workflow defines no signals."
                  : "Workflow metadata is still loading — try again in a moment."}
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setSignalling(false)}
                >
                  Close
                </button>
              </div>
            </Modal>
          )
        ) : null}
        {!modal &&
        commanding &&
        detail &&
        detail.id === selectedId &&
        detailCommands.length > 0 ? (
          <CommandModal
            commands={detailCommands}
            busy={busy}
            onSend={sendCommand}
            onClose={() => setCommanding(false)}
          />
        ) : null}
        {!modal &&
        resettingStep !== null &&
        detail &&
        detail.id === selectedId ? (
          <ResetDialog
            detail={detail}
            initialStepId={resettingStep || undefined}
            busy={busy}
            onReset={resetExecution}
            onClose={() => setResettingStep(null)}
          />
        ) : null}
        {!modal && confirming === "cancel" && selectedId ? (
          <ConfirmDialog
            title="Cancel execution"
            message="Request cancellation? Running steps observe it cooperatively; waits resolve as cancelled."
            confirmLabel="Cancel execution"
            danger
            onConfirm={() => {
              setConfirming(null);
              void act("Cancel", () => api.cancelExecution(selectedId));
            }}
            onClose={() => setConfirming(null)}
          />
        ) : null}
        {!modal && confirming === "retry" && selectedId ? (
          <ConfirmDialog
            title="Retry execution"
            message="Roll the execution back to pending and resume it from memoized steps?"
            confirmLabel="Retry execution"
            onConfirm={() => {
              setConfirming(null);
              void act("Retry", () => api.retryExecution(selectedId));
            }}
            onClose={() => setConfirming(null)}
          />
        ) : null}
        {!modal && confirming === "restart" && selectedId ? (
          <ConfirmDialog
            title="Restart execution"
            message="Start a fresh run from this execution's input? Steps re-run from the beginning with no carried state."
            confirmLabel="Restart execution"
            onConfirm={() => {
              const id = selectedId;
              setConfirming(null);
              void restartExecution(id);
            }}
            onClose={() => setConfirming(null)}
          />
        ) : null}
        {!modal && confirming === "force-fail" && selectedId ? (
          <ReasonDialog
            title="Force fail"
            message="Mark the execution failed immediately."
            confirmLabel="Force fail"
            placeholder="Why is this execution being failed?"
            onConfirm={(reason) => {
              setConfirming(null);
              void act("Force fail", () =>
                api.forceFailExecution(selectedId, reason)
              );
            }}
            onClose={() => setConfirming(null)}
          />
        ) : null}
        {!modal && operatorAction && detail ? (
          <OperatorDialog
            action={operatorAction}
            detail={detail}
            busy={busy}
            onSubmit={(stepId, reason, result) => {
              const action = operatorAction;
              setOperatorAction(null);
              void act(
                action === "skip" ? "Skip step" : "Edit state",
                async () => {
                  if (action === "skip") {
                    await api.skipStep(detail.id, stepId, reason);
                    pushToast("success", `Skipped ${stepId}.`);
                  } else {
                    await api.editState(detail.id, stepId, result, reason);
                    pushToast("success", `Updated ${stepId}.`);
                  }
                }
              );
            }}
            onClose={() => setOperatorAction(null)}
          />
        ) : null}
        <Toasts toasts={toasts} />
      </div>
    </WorkflowApiContext.Provider>
  );
}

function truncateMiddle(id: string): string {
  return id.length > 18 ? `${id.slice(0, 10)}…${id.slice(-4)}` : id;
}

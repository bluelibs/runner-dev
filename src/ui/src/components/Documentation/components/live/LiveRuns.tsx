import React, { useState, useRef, useEffect } from "react";
import { graphqlRequest } from "../../utils/graphqlClient";
import { Introspector } from "../../../../../../resources/models/Introspector";
import { CodeModal } from "../CodeModal";
import { WriteCodeInput, InputRef } from "../common/Input";
import "./LiveRuns.scss";

interface LiveRunsProps {
  introspector: Introspector;
}

export const LiveRuns: React.FC<LiveRunsProps> = ({ introspector }) => {
  // Task running state
  const [taskId, setTaskId] = useState("");
  const [taskInput, setTaskInput] = useState("");
  const [taskEvalInput, setTaskEvalInput] = useState(false);
  const [taskRunning, setTaskRunning] = useState(false);
  const [taskError, setTaskError] = useState<unknown | null>(null);
  const [taskResult, setTaskResult] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskAutocomplete, setTaskAutocomplete] = useState<any[]>([]);
  const [showTaskAutocomplete, setShowTaskAutocomplete] = useState(false);
  const taskInputRef = useRef<InputRef>(null);

  // Event invocation state
  const [eventId, setEventId] = useState("");
  const [eventPayload, setEventPayload] = useState("");
  const [eventEvalInput, setEventEvalInput] = useState(false);
  const [eventInvoking, setEventInvoking] = useState(false);
  const [eventError, setEventError] = useState<unknown | null>(null);
  const [eventResult, setEventResult] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventAutocomplete, setEventAutocomplete] = useState<any[]>([]);
  const [showEventAutocomplete, setShowEventAutocomplete] = useState(false);
  const eventInputRef = useRef<InputRef>(null);

  const runTask = async () => {
    if (!taskId.trim()) return;

    setTaskRunning(true);
    setTaskResult(null);

    try {
      const INVOKE_TASK_MUTATION = `
        mutation InvokeTask($taskId: ID!, $inputJson: String, $evalInput: Boolean) {
          invokeTask(taskId: $taskId, inputJson: $inputJson, evalInput: $evalInput) {
            success
            error
            result
            invocationId
          }
        }
      `;

      const result = await graphqlRequest<{
        invokeTask: {
          success: boolean;
          error?: string | null;
          result?: string | null;
          invocationId?: string | null;
        };
      }>(INVOKE_TASK_MUTATION, {
        taskId,
        inputJson: taskInput.trim() || undefined,
        evalInput: taskEvalInput,
      });

      console.log(result.invokeTask);

      const resultMessage = result.invokeTask.success
        ? `// ✅ Task executed successfully\n${
            result.invokeTask.result ? `${result.invokeTask.result}` : ""
          }`
        : `// ❌ Task failed\n${
            result.invokeTask.error ? `${result.invokeTask.error}` : ""
          }`;

      setTaskResult(resultMessage);
      setTaskError(result.invokeTask.error);
      setShowTaskModal(true);
    } finally {
      setTaskRunning(false);
    }
  };

  // Autocomplete logic
  useEffect(() => {
    const tasks = introspector.getTasks();
    setTaskAutocomplete(tasks);
  }, [introspector]);

  useEffect(() => {
    const events = introspector.getEvents();
    setEventAutocomplete(events);
  }, [introspector]);

  const handleTaskIdChange = (value: string) => {
    setTaskId(value);
    setShowTaskAutocomplete(value.length > 0);
  };

  const handleEventIdChange = (value: string) => {
    setEventId(value);
    setShowEventAutocomplete(value.length > 0);
  };

  const selectTask = (task: any) => {
    setTaskId(task.id);
    setShowTaskAutocomplete(false);
    taskInputRef.current?.focus();
  };

  const selectEvent = (event: any) => {
    setEventId(event.id);
    setShowEventAutocomplete(false);
    eventInputRef.current?.focus();
  };

  const filteredTasks = taskAutocomplete.filter((task) =>
    task.id.toLowerCase().includes(taskId.toLowerCase())
  );

  const filteredEvents = eventAutocomplete.filter((event) =>
    event.id.toLowerCase().includes(eventId.toLowerCase())
  );

  const invokeEvent = async () => {
    if (!eventId.trim()) return;

    setEventInvoking(true);
    setEventResult(null);

    try {
      const INVOKE_EVENT_MUTATION = `
        mutation InvokeEvent($eventId: ID!, $inputJson: String, $evalInput: Boolean) {
          invokeEvent(eventId: $eventId, inputJson: $inputJson, evalInput: $evalInput) {
            success
            error
            invocationId
          }
        }
      `;

      const result = await graphqlRequest<{
        invokeEvent: {
          success: boolean;
          error?: string | null;
          invocationId?: string | null;
        };
      }>(INVOKE_EVENT_MUTATION, {
        eventId,
        inputJson: eventPayload.trim() || undefined,
        evalInput: eventEvalInput,
      });

      const resultMessage = result.invokeEvent.success
        ? `✅ Event invoked successfully`
        : `❌ Event failed${
            result.invokeEvent.error ? `: ${result.invokeEvent.error}` : ""
          }`;

      setEventResult(resultMessage);
      setShowEventModal(true);
    } catch (err) {
      setEventResult(
        `❌ Error: ${
          err instanceof Error ? err.message : "Failed to invoke event"
        }`
      );
    } finally {
      setEventInvoking(false);
    }
  };

  return (
    <div className="live-runs">
      <h3 className="live-runs__title">🚀 Live Actions</h3>
      <div className="live-runs__grid">
        {/* Run Task Section */}
        <div className="live-runs__panel">
          <h4 className="live-runs__panel-title">🏃 Run a Task</h4>
          <div className="live-runs__form">
            <WriteCodeInput
              ref={taskInputRef}
              placeholder="Task ID"
              value={taskId}
              onChange={handleTaskIdChange}
              onFocus={() => setShowTaskAutocomplete(taskId.length > 0)}
              onBlur={() =>
                setTimeout(() => setShowTaskAutocomplete(false), 200)
              }
              autocompleteItems={filteredTasks}
              showAutocomplete={showTaskAutocomplete}
              onSelectItem={selectTask}
              className="live-runs__input"
            />
            <textarea
              placeholder="Input (optional)"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              rows={3}
              className="live-runs__textarea"
            />
            <label className="live-runs__checkbox">
              <input
                type="checkbox"
                checked={taskEvalInput}
                onChange={(e) => setTaskEvalInput(e.target.checked)}
              />
              <span className="live-runs__checkbox-label">Eval Input</span>
            </label>
            <button
              onClick={runTask}
              disabled={taskRunning || !taskId.trim()}
              className={`live-runs__button live-runs__button--primary ${
                taskRunning ? "live-runs__button--disabled" : ""
              }`}
            >
              {taskRunning ? "⏳ Running..." : "▶️ Run Task"}
            </button>
            {taskResult && (
              <div
                className={`live-runs__result ${
                  taskResult.includes("✅")
                    ? "live-runs__result--success"
                    : "live-runs__result--error"
                }`}
              >
                {taskResult.includes("✅")
                  ? "Last run was successful"
                  : "Last run failed"}
              </div>
            )}
          </div>
        </div>

        {/* Invoke Event Section */}
        <div className="live-runs__panel">
          <h4 className="live-runs__panel-title">📡 Invoke Event</h4>
          <div className="live-runs__form">
            <WriteCodeInput
              ref={eventInputRef}
              placeholder="Event ID"
              value={eventId}
              onChange={handleEventIdChange}
              onFocus={() => setShowEventAutocomplete(eventId.length > 0)}
              onBlur={() =>
                setTimeout(() => setShowEventAutocomplete(false), 200)
              }
              autocompleteItems={filteredEvents}
              showAutocomplete={showEventAutocomplete}
              onSelectItem={selectEvent}
              className="live-runs__input"
            />
            <textarea
              placeholder="Payload (JSON, optional)"
              value={eventPayload}
              onChange={(e) => setEventPayload(e.target.value)}
              rows={3}
              className="live-runs__textarea"
            />
            <label className="live-runs__checkbox">
              <input
                type="checkbox"
                checked={eventEvalInput}
                onChange={(e) => setEventEvalInput(e.target.checked)}
              />
              <span className="live-runs__checkbox-label">Eval Input</span>
            </label>
            <button
              onClick={invokeEvent}
              disabled={eventInvoking || !eventId.trim()}
              className={`live-runs__button live-runs__button--success ${
                eventInvoking ? "live-runs__button--disabled" : ""
              }`}
            >
              {eventInvoking ? "⏳ Invoking..." : "🚀 Invoke Event"}
            </button>
            {/* {eventResult && (
              <div
                className={`live-runs__result ${
                  eventResult.includes("✅")
                    ? "live-runs__result--success"
                    : "live-runs__result--error"
                }`}
              >
                {eventResult}
              </div>
            )} */}
          </div>
        </div>
      </div>

      <CodeModal
        title="Task Result"
        subtitle={taskId}
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        code={taskResult}
      />

      <CodeModal
        title="Event Result"
        subtitle={eventId}
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        code={eventResult}
      />
    </div>
  );
};

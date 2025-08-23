import React, { useState, useRef, useEffect } from "react";
import { graphqlRequest } from "../../utils/graphqlClient";
import { Introspector } from "../../../../../../resources/models/Introspector";
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
  const [taskResult, setTaskResult] = useState<string | null>(null);
  const [taskAutocomplete, setTaskAutocomplete] = useState<any[]>([]);
  const [showTaskAutocomplete, setShowTaskAutocomplete] = useState(false);
  const taskInputRef = useRef<HTMLInputElement>(null);

  // Event invocation state
  const [eventId, setEventId] = useState("");
  const [eventPayload, setEventPayload] = useState("");
  const [eventEvalInput, setEventEvalInput] = useState(false);
  const [eventInvoking, setEventInvoking] = useState(false);
  const [eventResult, setEventResult] = useState<string | null>(null);
  const [eventAutocomplete, setEventAutocomplete] = useState<any[]>([]);
  const [showEventAutocomplete, setShowEventAutocomplete] = useState(false);
  const eventInputRef = useRef<HTMLInputElement>(null);

  const runTask = async () => {
    if (!taskId.trim()) return;

    setTaskRunning(true);
    setTaskResult(null);

    try {
      const RUN_TASK_MUTATION = `
        mutation RunTask($id: ID!, $input: String, $evalInput: Boolean) {
          runTask(id: $id, input: $input, evalInput: $evalInput) {
            success
            message
          }
        }
      `;

      const result = await graphqlRequest<{
        runTask: { success: boolean; message?: string };
      }>(RUN_TASK_MUTATION, {
        id: taskId,
        input: taskInput.trim() || undefined,
        evalInput: taskEvalInput,
      });

      setTaskResult(
        result.runTask.success
          ? `✅ Task executed successfully${
              result.runTask.message ? `: ${result.runTask.message}` : ""
            }`
          : `❌ Task failed${
              result.runTask.message ? `: ${result.runTask.message}` : ""
            }`
      );
    } catch (err) {
      setTaskResult(
        `❌ Error: ${err instanceof Error ? err.message : "Failed to run task"}`
      );
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

  const filteredTasks = taskAutocomplete.filter(task => 
    task.id.toLowerCase().includes(taskId.toLowerCase())
  );

  const filteredEvents = eventAutocomplete.filter(event => 
    event.id.toLowerCase().includes(eventId.toLowerCase())
  );

  const invokeEvent = async () => {
    if (!eventId.trim()) return;

    setEventInvoking(true);
    setEventResult(null);

    try {
      const INVOKE_EVENT_MUTATION = `
        mutation InvokeEvent($id: ID!, $payload: String, $evalInput: Boolean) {
          invokeEvent(id: $id, payload: $payload, evalInput: $evalInput) {
            success
            message
          }
        }
      `;

      const result = await graphqlRequest<{
        invokeEvent: { success: boolean; message?: string };
      }>(INVOKE_EVENT_MUTATION, {
        id: eventId,
        payload: eventPayload.trim() || undefined,
        evalInput: eventEvalInput,
      });

      setEventResult(
        result.invokeEvent.success
          ? `✅ Event invoked successfully${
              result.invokeEvent.message
                ? `: ${result.invokeEvent.message}`
                : ""
            }`
          : `❌ Event failed${
              result.invokeEvent.message
                ? `: ${result.invokeEvent.message}`
                : ""
            }`
      );
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
            <div className="live-runs__autocomplete-container">
              <input
                ref={taskInputRef}
                type="text"
                placeholder="Task ID"
                value={taskId}
                onChange={(e) => handleTaskIdChange(e.target.value)}
                onFocus={() => setShowTaskAutocomplete(taskId.length > 0)}
                onBlur={() => setTimeout(() => setShowTaskAutocomplete(false), 200)}
                className="live-runs__input"
              />
              {showTaskAutocomplete && filteredTasks.length > 0 && (
                <div className="live-runs__autocomplete">
                  {filteredTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="live-runs__autocomplete-item"
                      onClick={() => selectTask(task)}
                    >
                      <div className="live-runs__autocomplete-id">{task.id}</div>
                      {task.meta?.title && (
                        <div className="live-runs__autocomplete-title">{task.meta.title}</div>
                      )}
                      {task.meta?.description && (
                        <div className="live-runs__autocomplete-description">{task.meta.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                {taskResult}
              </div>
            )}
          </div>
        </div>

        {/* Invoke Event Section */}
        <div className="live-runs__panel">
          <h4 className="live-runs__panel-title">📡 Invoke Event</h4>
          <div className="live-runs__form">
            <div className="live-runs__autocomplete-container">
              <input
                ref={eventInputRef}
                type="text"
                placeholder="Event ID"
                value={eventId}
                onChange={(e) => handleEventIdChange(e.target.value)}
                onFocus={() => setShowEventAutocomplete(eventId.length > 0)}
                onBlur={() => setTimeout(() => setShowEventAutocomplete(false), 200)}
                className="live-runs__input"
              />
              {showEventAutocomplete && filteredEvents.length > 0 && (
                <div className="live-runs__autocomplete">
                  {filteredEvents.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="live-runs__autocomplete-item"
                      onClick={() => selectEvent(event)}
                    >
                      <div className="live-runs__autocomplete-id">{event.id}</div>
                      {event.meta?.title && (
                        <div className="live-runs__autocomplete-title">{event.meta.title}</div>
                      )}
                      {event.meta?.description && (
                        <div className="live-runs__autocomplete-description">{event.meta.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
            {eventResult && (
              <div
                className={`live-runs__result ${
                  eventResult.includes("✅")
                    ? "live-runs__result--success"
                    : "live-runs__result--error"
                }`}
              >
                {eventResult}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

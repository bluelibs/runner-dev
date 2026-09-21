import { graphqlRequest } from "./graphqlClient";

export interface InvokeElementResult {
  output?: string;
  error?: string;
}

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

const INVOKE_EVENT_MUTATION = `
  mutation InvokeEvent($eventId: ID!, $inputJson: String, $evalInput: Boolean) {
    invokeEvent(eventId: $eventId, inputJson: $inputJson, evalInput: $evalInput) {
      success
      error
      invocationId
    }
  }
`;

/**
 * Runs a task through the standard pipeline. Shared by the TaskCard Run
 * modal and the list-level execute handling so both stay in sync.
 */
export async function invokeTaskById(
  taskId: string,
  inputJson?: string
): Promise<InvokeElementResult> {
  try {
    const res = await graphqlRequest<{
      invokeTask: {
        success: boolean;
        error?: string | null;
        result?: string | null;
        invocationId?: string | null;
      };
    }>(INVOKE_TASK_MUTATION, {
      taskId,
      inputJson: inputJson?.trim() || undefined,
      evalInput: false,
    });

    return {
      output: res.invokeTask.result ?? undefined,
      error: res.invokeTask.error ?? undefined,
    };
  } catch (e: any) {
    return { error: e?.message ?? String(e) };
  }
}

/**
 * Emits an event. Shared by the EventCard Emit modal and the list-level
 * execute handling so both stay in sync.
 */
export async function invokeEventById(
  eventId: string,
  inputJson?: string
): Promise<InvokeElementResult> {
  try {
    const res = await graphqlRequest<{
      invokeEvent: {
        success: boolean;
        error?: string | null;
        invocationId?: string | null;
      };
    }>(INVOKE_EVENT_MUTATION, {
      eventId,
      inputJson: inputJson?.trim() || undefined,
      evalInput: false,
    });

    return {
      output: res.invokeEvent.success
        ? "Event invoked successfully"
        : res.invokeEvent.error ?? undefined,
      error: res.invokeEvent.error ?? undefined,
    };
  } catch (e: any) {
    return { error: e?.message ?? String(e) };
  }
}

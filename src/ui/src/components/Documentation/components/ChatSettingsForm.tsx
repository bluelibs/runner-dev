import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ChatSettings } from "./ChatTypes";
import {
  Form,
  FormActions,
  FormGroup,
  FormRow,
  PasswordInput,
  TextInput,
} from "./common/FormControls";

export interface ChatSettingsFormValues {
  openaiApiKey: string;
  baseUrl: string;
  model: string;
  stream: boolean;
  enableShortcuts: boolean;
  showTokenMeter: boolean;
  virtualizeMessages: boolean;
}

export interface ChatSettingsFormProps {
  settings: ChatSettings;
  onSave: (settings: ChatSettings) => void;
  onTest: (
    overrideKey?: string,
    overrideBaseUrl?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onClearKey: () => void;
}

export const ChatSettingsForm: React.FC<ChatSettingsFormProps> = ({
  settings,
  onSave,
  onTest,
  onClearKey,
}) => {
  const defaults = useMemo<ChatSettingsFormValues>(
    () => ({
      openaiApiKey: settings.openaiApiKey || "",
      baseUrl: settings.baseUrl || "https://api.openai.com",
      model: settings.model,
      stream: settings.stream,
      enableShortcuts: settings.enableShortcuts ?? true,
      showTokenMeter: settings.showTokenMeter ?? true,
      virtualizeMessages: settings.virtualizeMessages ?? false,
    }),
    [settings]
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<ChatSettingsFormValues>({
    defaultValues: defaults,
  });

  const [connState, setConnState] = useState<
    "idle" | "testing" | "ok" | "error"
  >("idle");
  const [connError, setConnError] = useState<string | undefined>(undefined);

  const onSubmit = (values: ChatSettingsFormValues) => {
    const next: ChatSettings = {
      openaiApiKey: values.openaiApiKey || null,
      baseUrl: values.baseUrl || "https://api.openai.com",
      model: values.model,
      stream: values.stream,
      // Keep existing responseMode unchanged; it's removed from UI
      responseMode: settings.responseMode,
      enableShortcuts: values.enableShortcuts,
      showTokenMeter: values.showTokenMeter,
      virtualizeMessages: values.virtualizeMessages,
    };
    onSave(next);
  };

  return (
    <Form className="dark-mode" onSubmit={handleSubmit(onSubmit)}>
      <FormRow>
        <FormGroup
          label="OpenAI API Key"
          htmlFor="openai-key"
          hint="Stored locally in your browser via localStorage."
        >
          <PasswordInput
            id="openai-key"
            placeholder="sk-..."
            {...register("openaiApiKey")}
          />
        </FormGroup>
        <FormGroup
          label="OpenAI Base URL"
          htmlFor="openai-base"
          hint="For proxies or Azure-hosted endpoints."
        >
          <TextInput
            id="openai-base"
            placeholder="https://api.openai.com"
            {...register("baseUrl")}
          />
        </FormGroup>
        <FormGroup
          label="Model"
          htmlFor="openai-model"
          hint="Example: gpt-5-mini"
        >
          <TextInput id="openai-model" {...register("model")} />
        </FormGroup>
        <FormGroup label="Streaming">
          <label className="form__checkbox">
            <input id="openai-stream" type="checkbox" {...register("stream")} />
            <span className="form__checkbox-label">Enable token streaming</span>
          </label>
        </FormGroup>
        <FormGroup label="Shortcuts">
          <label className="form__checkbox">
            <input
              id="enable-shortcuts"
              type="checkbox"
              {...register("enableShortcuts")}
            />
            <span className="form__checkbox-label">
              Enable keyboard shortcuts
            </span>
          </label>
        </FormGroup>
        <FormGroup label="Token meter">
          <label className="form__checkbox">
            <input
              id="show-token-meter"
              type="checkbox"
              {...register("showTokenMeter")}
            />
            <span className="form__checkbox-label">
              Show context token meter
            </span>
          </label>
        </FormGroup>
        <FormGroup label="Virtualize messages">
          <label className="form__checkbox">
            <input
              id="virtualize-messages"
              type="checkbox"
              {...register("virtualizeMessages")}
            />
            <span className="form__checkbox-label">High-performance mode</span>
          </label>
        </FormGroup>
      </FormRow>

      <FormActions>
        <button
          type="submit"
          className="btn btn--primary"
          title="Save settings"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            reset(defaults);
          }}
          className="btn"
          title="Reset"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={async () => {
            setConnState("testing");
            setConnError(undefined);
            const cur =
              (document.getElementById("openai-key") as HTMLInputElement)
                ?.value || defaults.openaiApiKey;
            const base =
              (document.getElementById("openai-base") as HTMLInputElement)
                ?.value || defaults.baseUrl;
            const res = await onTest(cur, base);
            if (res.ok) setConnState("ok");
            else {
              setConnState("error");
              setConnError(res.error);
            }
          }}
          className="btn"
          title="Test connection"
        >
          {connState === "testing" ? "Testing…" : "Test"}
        </button>
        <button
          type="button"
          onClick={() => {
            onClearKey();
            reset({ ...defaults, openaiApiKey: "" });
            setConnState("idle");
            setConnError(undefined);
          }}
          className="btn"
          title="Clear API key"
        >
          Clear
        </button>
        <span
          className={`status ${
            connState === "ok"
              ? "status--ok"
              : connState === "error"
              ? "status--error"
              : ""
          }`}
        >
          {connState === "ok"
            ? "Connected"
            : connState === "error"
            ? "Error"
            : ""}
        </span>
      </FormActions>

      {connState === "error" && connError && (
        <div className="form__error">{connError}</div>
      )}
    </Form>
  );
};

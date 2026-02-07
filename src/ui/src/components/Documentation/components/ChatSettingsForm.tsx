import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ChatSettings } from "./chat/ChatTypes";
import {
  Form,
  FormActions,
  FormGroup,
  PasswordInput,
  TextInput,
} from "./common/FormControls";

export interface ChatSettingsFormValues {
  openaiApiKey: string;
  baseUrl: string;
  model: string;
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
    }),
    [settings]
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { isDirty: _isDirty },
  } = useForm<ChatSettingsFormValues>({
    defaultValues: defaults,
  });

  // Ensure the form reflects the latest incoming settings. If `settings` changes
  // (for example when persisted settings are loaded or updated elsewhere), reset
  // the form values to the computed defaults so the Reset button and form state
  // stay in sync with the source of truth.
  React.useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  const [connState, setConnState] = useState<
    "idle" | "testing" | "ok" | "error"
  >("idle");
  const [connError, setConnError] = useState<string | undefined>(undefined);

  const onSubmit = (values: ChatSettingsFormValues) => {
    const next: ChatSettings = {
      openaiApiKey: values.openaiApiKey || null,
      baseUrl: values.baseUrl || "https://api.openai.com",
      model: values.model,
      // Keep existing values for fields removed from the UI
      stream: settings.stream,
      responseMode: settings.responseMode,
      enableShortcuts: settings.enableShortcuts,
      showTokenMeter: settings.showTokenMeter,
      virtualizeMessages: settings.virtualizeMessages,
    };
    onSave(next);
  };

  return (
    <Form className="dark-mode" onSubmit={handleSubmit(onSubmit)}>
      <>
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
      </>

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
            // Call reset to update RHF internal state, and also explicitly set
            // each field so forwarded/custom inputs are updated reliably.
            reset(defaults);
            setValue("openaiApiKey", defaults.openaiApiKey);
            setValue("baseUrl", defaults.baseUrl);
            setValue("model", defaults.model);
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
            const next = { ...defaults, openaiApiKey: "" };
            reset(next);
            setValue("openaiApiKey", "");
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

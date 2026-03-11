/** @jest-environment jsdom */

import { MAX_OUTPUT_TOKENS, streamChatCompletion } from "./ai.service";

describe("streamChatCompletion", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  test("sends a 20k max completion token limit on chat requests", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content: "done" },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      }),
    });

    global.fetch = fetchMock as typeof fetch;

    await streamChatCompletion(
      {
        settings: {
          openaiApiKey: "test-key",
          model: "gpt-5-mini",
          stream: false,
          responseMode: "text",
          baseUrl: "https://api.openai.com",
        },
        messages: [{ role: "user", content: "hello" }],
      },
      {}
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(body.max_completion_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(body.max_completion_tokens).toBe(20_000);
  });
});

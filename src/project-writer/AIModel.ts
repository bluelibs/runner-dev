import { OpenAI } from "./../../node_modules/openai/src/client";
import { ZodSchema } from "zod";

export type AskOptionsType = {
  history?: string[];
  responseSchema?: ZodSchema;
};

const defaultAskOptions: AskOptionsType = {
  history: [],
  responseSchema: undefined,
};

export type AskResultType<T> = {
  answer: T;
  history: string[];
};

export interface IModel {
  id: string;
  ask(input: string, options?: AskOptionsType): Promise<AskResultType<string>>;
  askJSON<T>(
    input: string,
    options?: AskOptionsType
  ): Promise<AskResultType<T>>;
}

export type AIModelOptionsType = {
  modelId: string;
  name: string;
  openai: OpenAI;
  context: string;
};

const defaultAIModelOptions: Partial<AIModelOptionsType> = {
  modelId: "default",
  name: "AI",
  openai: undefined,
  context: "",
};

export class AIModel implements IModel {
  id: string;
  openai: OpenAI;
  context: string;

  constructor(options: AIModelOptionsType) {
    const mergedOptions = { ...defaultAIModelOptions, ...options };

    this.id = mergedOptions.modelId;
    this.openai = mergedOptions.openai;
    this.context = mergedOptions.context;
  }

  async ask(
    input: string,
    options?: AskOptionsType
  ): Promise<AskResultType<string>> {
    const mergedOptions = { ...defaultAskOptions, ...options };

    return {
      answer: "",
      history: [],
    };
    // const response = await this.openai.responses.create({
    //   model: this.id,
    //   input: [
    //     { role: "system", content: this.context },
    //     { role: "user", content: input },
    //   ],
    // });
    // const result = response.text
    // return {
    //   answer: result,
    //   history: [],
    // };
  }

  askJSON<T>(
    input: string,
    options?: AskOptionsType
  ): Promise<AskResultType<T>> {
    return Promise.resolve({ answer: {} as T, history: [] });
  }
}

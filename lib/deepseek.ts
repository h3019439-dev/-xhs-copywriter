import OpenAI from "openai";

export function createDeepSeekClient(apiKey: string) {
  return new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey,
  });
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function chatWithDeepSeek(
  client: OpenAI,
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  }
) {
  return client.chat.completions.create(
    {
      model: "deepseek-chat",
      messages,
      temperature: options?.temperature ?? 0.8,
      max_tokens: options?.maxTokens ?? 4096,
      response_format: { type: "json_object" },
    },
    {
      signal: options?.signal,
    }
  );
}

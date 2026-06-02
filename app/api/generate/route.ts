export const runtime = "edge";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createDeepSeekClient, chatWithDeepSeek, ChatMessage } from "@/lib/deepseek";
import { retrieveRelevantAtoms } from "@/lib/knowledge-base";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompt-templates";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      input,
      apiKey,
      messages = [],
    }: {
      input: string;
      apiKey: string;
      messages?: { role: "user" | "assistant"; content: string }[];
    } = body;

    if (!input?.trim()) {
      return NextResponse.json({ error: "请输入内容" }, { status: 400 });
    }
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: "请先设置API Key" }, { status: 400 });
    }

    const client = createDeepSeekClient(apiKey);
    const atoms = retrieveRelevantAtoms(input, 5);
    const systemPrompt = buildSystemPrompt(atoms);
    const userPrompt = buildUserPrompt(input, messages);

    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages,
      { role: "user", content: userPrompt },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 58_000);

    try {
      const response = await chatWithDeepSeek(client, chatMessages, {
        temperature: 0.85,
        maxTokens: 8192,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return NextResponse.json({ error: "API返回为空，请重试" }, { status: 500 });
      }

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        const cleaned = content
          .replace(/^```json?\s*/i, "")
          .replace(/\s*```$/, "")
          .trim();
        parsed = JSON.parse(cleaned);
      }

      if (!parsed.versions || !Array.isArray(parsed.versions)) {
        return NextResponse.json(
          { error: "格式异常，请重试", raw: content },
          { status: 500 }
        );
      }

      const versions = parsed.versions.map((v: Record<string, unknown>) => ({
        title: typeof v.title === "string" ? v.title : "",
        body: typeof v.body === "string" ? v.body : "",
        tags: Array.isArray(v.tags) ? v.tags : [],
        angle: typeof v.angle === "string" ? v.angle : "",
        score: typeof v.score === "number" ? v.score : 0,
        scoring_notes: typeof v.scoring_notes === "string" ? v.scoring_notes : "",
      }));

      return NextResponse.json({
        versions,
        summary: parsed.summary || "",
        usage: {
          prompt_tokens: response.usage?.prompt_tokens,
          completion_tokens: response.usage?.completion_tokens,
        },
      });
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        return NextResponse.json(
          { error: "生成时间较长，请再试一次", retryable: true },
          { status: 504 }
        );
      }
      throw err;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误，请重试";
    console.error("Generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { createFileRoute } from "@tanstack/react-router";
import { AI_MODEL_CONFIGS, AIModelType } from "@/config/ai";
import { getGeminiModelInstance } from "@/lib/server/gemini";

const parseUpstreamError = (raw: string, fallback: string) => {
  if (!raw) return fallback;
  const text = raw.trim();
  if (/^<!doctype html/i.test(text) || /^<html/i.test(text)) {
    const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/\s+/g, " ")
      .trim();
    return title || fallback;
  }

  try {
    const data = JSON.parse(text) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof data.error === "string") return data.error;
    return data.error?.message || data.message || fallback;
  } catch {
    return text;
  }
};

export const Route = createFileRoute("/api/ai-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();

        try {
          const body = await request.json();
          const { provider = "custom", apiKey, model, apiEndpoint } = body as {
            provider?: AIModelType;
            apiKey?: string;
            model?: string;
            apiEndpoint?: string;
          };

          const modelConfig = AI_MODEL_CONFIGS[provider];
          if (!modelConfig) {
            return Response.json({
              ok: false,
              error: "无效的 AI 服务商。",
              latencyMs: Date.now() - startedAt,
            });
          }

          if (!apiKey || !model) {
            return Response.json({
              ok: false,
              error: "请完整填写 API Key 和模型 ID。",
              latencyMs: Date.now() - startedAt,
            });
          }

          if (provider === "gemini") {
            const modelInstance = getGeminiModelInstance({
              apiKey,
              model,
              generationConfig: {
                temperature: 0,
              },
            });
            const result = await modelInstance.generateContent("Reply with OK only.");
            return Response.json({
              ok: true,
              latencyMs: Date.now() - startedAt,
              content: result.response.text() || "",
            });
          }

          const requestUrl = modelConfig.url(apiEndpoint);
          if (!requestUrl.startsWith("http")) {
            return Response.json({
              ok: false,
              error: "请完整填写 API Endpoint。",
              latencyMs: Date.now() - startedAt,
            });
          }

          const response = await fetch(requestUrl, {
            method: "POST",
            headers: modelConfig.headers(apiKey),
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "user",
                  content: "Reply with OK only.",
                },
              ],
              max_tokens: 8,
              stream: false,
            }),
          });

          const latencyMs = Date.now() - startedAt;
          const raw = await response.text();
          if (!response.ok) {
            return Response.json({
              ok: false,
              error: parseUpstreamError(
                raw,
                `连接失败：${response.status} ${response.statusText}`
              ),
              latencyMs,
            });
          }

          let content = "";
          try {
            const data = raw ? JSON.parse(raw) : {};
            content = data?.choices?.[0]?.message?.content || "";
          } catch {}

          return Response.json({
            ok: true,
            latencyMs,
            content,
          });
        } catch (error) {
          return Response.json({
            ok: false,
            error: error instanceof Error ? error.message : "连接测试失败",
            latencyMs: Date.now() - startedAt,
          });
        }
      },
    },
  },
});

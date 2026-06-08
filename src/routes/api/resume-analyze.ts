import { createFileRoute } from "@tanstack/react-router";
import { AI_MODEL_CONFIGS, AIModelType } from "@/config/ai";
import { analyzeResumeLocally, mergeAiAnalysis } from "@/lib/resumeAnalysis";
import {
  formatGeminiErrorMessage,
  getGeminiModelInstance,
} from "@/lib/server/gemini";
import { ResumeAnalysis, ResumeData, ResumeRewriteSuggestion } from "@/types/resume";

const parseJsonPayload = (content: string) => {
  const text = content.trim();
  try {
    return JSON.parse(text);
  } catch {}

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }

  const objectBlock = text.match(/\{[\s\S]*\}/);
  if (objectBlock?.[0]) {
    try {
      return JSON.parse(objectBlock[0]);
    } catch {}
  }

  return null;
};

const parseUpstreamError = (raw: string, fallback: string) => {
  if (!raw) return fallback;
  const text = raw.trim();
  if (/^<!doctype html/i.test(text) || /^<html/i.test(text)) {
    const title = text
      .match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/\s+/g, " ")
      .trim();
    return title
      ? `AI 服务商网关错误：${title}`
      : "AI 服务商网关错误，请检查 API Endpoint 是否可用，或稍后重试。";
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

const createErrorResponse = (error: string, status = 400) =>
  Response.json(
    {
      ok: false,
      error,
    },
    { status }
  );

const toNumberScore = (value: unknown, fallback: number) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const toStringArray = (value: unknown, limit = 12) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);
};

const normalizeRewrites = (value: unknown): ResumeRewriteSuggestion[] => {
  if (!Array.isArray(value)) return [];
  const sections: ResumeRewriteSuggestion["section"][] = [
    "basic",
    "skills",
    "experience",
    "projects",
    "selfEvaluation",
  ];

  return value
    .map((item) => {
      const record = item as Partial<ResumeRewriteSuggestion>;
      const section = sections.includes(record.section as ResumeRewriteSuggestion["section"])
        ? (record.section as ResumeRewriteSuggestion["section"])
        : "projects";

      return {
        section,
        title: String(record.title || "").trim(),
        before: record.before ? String(record.before).trim() : undefined,
        after: String(record.after || "").trim(),
      };
    })
    .filter((item) => item.title && item.after)
    .slice(0, 8);
};

const normalizeAiAnalysis = (
  value: unknown,
  base: ResumeAnalysis
): Partial<ResumeAnalysis> => {
  const data = (value || {}) as Record<string, unknown>;
  const keywords = Array.isArray(data.keywords)
    ? data.keywords
        .map((item) => {
          const record = item as {
            keyword?: unknown;
            matched?: unknown;
            category?: unknown;
          };
          const category = String(record.category || "general");
          return {
            keyword: String(record.keyword || "").trim(),
            matched: Boolean(record.matched),
            category: ["skill", "role", "tool", "quality", "general"].includes(category)
              ? (category as ResumeAnalysis["keywords"][number]["category"])
              : "general",
          };
        })
        .filter((item) => item.keyword)
        .slice(0, 40)
    : [];

  return {
    overallScore: toNumberScore(data.overallScore, base.overallScore),
    keywordScore: toNumberScore(data.keywordScore, base.keywordScore),
    skillScore: toNumberScore(data.skillScore, base.skillScore),
    projectScore: toNumberScore(data.projectScore, base.projectScore),
    atsScore: toNumberScore(data.atsScore, base.atsScore),
    keywords,
    missingKeywords: toStringArray(data.missingKeywords, 16),
    strengths: toStringArray(data.strengths, 10),
    risks: toStringArray(data.risks, 10),
    suggestions: toStringArray(data.suggestions, 12),
    rewrites: normalizeRewrites(data.rewrites),
    summary: typeof data.summary === "string" ? data.summary.trim() : base.summary,
  };
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const createSystemInstruction = (language: string) => `你是资深招聘简历优化顾问和 ATS 解析顾问。你会基于本地规则评分结果、简历内容和岗位 JD，补充更具体的岗位匹配建议。

输出要求：
1. 只输出合法 JSON 对象，不要 Markdown，不要解释。
2. 必须使用 ${language}。
3. 不要编造学历、公司、项目指标、工作年限或不存在的技能；只能提出“建议如何补充证据”。
4. 总分和分项分数可以在本地规则分基础上小幅校准，但必须是 0-100 的整数。
5. 建议要可执行，优先围绕 JD 关键词、专业技能、项目经历、ATS 可读性。
6. 如果目标岗位是测试工程师，建议必须突出测试策略、用例设计、接口/自动化测试、缺陷定位、质量保障、回归测试、CI 测试集成等方向。

JSON 结构：
{
  "overallScore": 78,
  "keywordScore": 75,
  "skillScore": 80,
  "projectScore": 72,
  "atsScore": 84,
  "summary": "一句总结",
  "keywords": [{"keyword": "关键词", "matched": true, "category": "skill"}],
  "missingKeywords": ["缺失关键词"],
  "strengths": ["优势"],
  "risks": ["风险"],
  "suggestions": ["优化建议"],
  "rewrites": [
    {
      "section": "projects",
      "title": "建议标题",
      "before": "可选，原文问题",
      "after": "可直接替换或参考的简历文案"
    }
  ]
}`;

export const Route = createFileRoute("/api/resume-analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let fallbackAnalysis: ResumeAnalysis | null = null;
        try {
          const body = await request.json();
          const {
            resume,
            jobDescription = "",
            targetRole = "",
            locale = "zh",
            apiKey,
            model,
            modelType = "gemini",
            apiEndpoint,
            baseAnalysis,
          } = body as {
            resume?: ResumeData;
            jobDescription?: string;
            targetRole?: string;
            locale?: string;
            apiKey?: string;
            model?: string;
            modelType?: AIModelType;
            apiEndpoint?: string;
            baseAnalysis?: ResumeAnalysis;
          };

          if (!resume?.id) {
            return createErrorResponse("缺少可分析的简历数据。");
          }

          const base =
            baseAnalysis ||
            analyzeResumeLocally({
              resume,
              jobDescription,
              targetRole,
              locale,
            });
          fallbackAnalysis = base;

          const modelConfig = AI_MODEL_CONFIGS[modelType];
          if (!modelConfig) {
            return Response.json({
              ok: true,
              analysis: {
                ...base,
                aiError: "无效的 AI 服务商，已保留本地规则分析结果。",
              },
            });
          }

          if (!apiKey || !model) {
            return Response.json({
              ok: true,
              analysis: {
                ...base,
                aiError: "未配置完整的 AI API Key 或模型 ID，已保留本地规则分析结果。",
              },
            });
          }

          const language = locale === "en" ? "English" : "Chinese";
          const systemInstruction = createSystemInstruction(language);
          const userContent = [
            `目标岗位：${targetRole || resume.targetRole || ""}`,
            `岗位 JD：\n${jobDescription || resume.jobDescription || ""}`,
            `本地规则分析结果：\n${JSON.stringify(base, null, 2)}`,
            `简历结构数据：\n${JSON.stringify(resume, null, 2).slice(0, 80000)}`,
          ].join("\n\n");

          let aiContent = "";

          if (modelType === "gemini") {
            const modelInstance = getGeminiModelInstance({
              apiKey,
              model,
              systemInstruction,
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
              },
            });

            const result = await modelInstance.generateContent(userContent);
            aiContent = result.response.text();
          } else {
            const requestUrl = modelConfig.url(apiEndpoint);
            if (!requestUrl.startsWith("http")) {
              return Response.json({
                ok: true,
                analysis: {
                  ...base,
                  aiError: "API Endpoint 配置无效，已保留本地规则分析结果。",
                },
              });
            }

            const response = await fetch(requestUrl, {
              method: "POST",
              headers: modelConfig.headers(apiKey),
              body: JSON.stringify({
                model: modelConfig.requiresModelId ? model : modelConfig.defaultModel,
                temperature: 0.2,
                response_format: {
                  type: "json_object",
                },
                messages: [
                  {
                    role: "system",
                    content: systemInstruction,
                  },
                  {
                    role: "user",
                    content: userContent,
                  },
                ],
              }),
            });

            const raw = await response.text();
            if (!response.ok) {
              return Response.json({
                ok: true,
                analysis: {
                  ...base,
                  aiError: parseUpstreamError(
                    raw,
                    `AI 服务商请求失败：${response.status} ${response.statusText}`
                  ),
                },
              });
            }

            let data: ChatCompletionResponse = {};
            try {
              data = raw ? JSON.parse(raw) : {};
            } catch {
              return Response.json({
                ok: true,
                analysis: {
                  ...base,
                  aiError: parseUpstreamError(
                    raw,
                    "AI 服务商返回内容不是有效 JSON，已保留本地规则分析结果。"
                  ),
                },
              });
            }
            aiContent = data?.choices?.[0]?.message?.content || "";
          }

          const parsed = aiContent ? parseJsonPayload(aiContent) : null;
          if (!parsed) {
            return Response.json({
              ok: true,
              analysis: {
                ...base,
                aiError: "AI 未返回有效 JSON，已保留本地规则分析结果。",
              },
            });
          }

          const analysis = mergeAiAnalysis(base, normalizeAiAnalysis(parsed, base));

          return Response.json({
            ok: true,
            analysis,
          });
        } catch (error) {
          console.error("Resume analysis error:", error);
          if (fallbackAnalysis) {
            return Response.json({
              ok: true,
              analysis: {
                ...fallbackAnalysis,
                aiError:
                  error instanceof Error
                    ? error.message
                    : formatGeminiErrorMessage(error),
              },
            });
          }
          return createErrorResponse(
            error instanceof Error ? error.message : formatGeminiErrorMessage(error),
            500
          );
        }
      },
    },
  },
});

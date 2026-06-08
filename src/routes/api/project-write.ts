import { createFileRoute } from "@tanstack/react-router";
import { AI_MODEL_CONFIGS, AIModelType } from "@/config/ai";
import {
  formatGeminiErrorMessage,
  getGeminiModelInstance,
} from "@/lib/server/gemini";

type SourceFile = {
  path: string;
  content: string;
};

type ProjectDraft = {
  name?: string;
  role?: string;
  date?: string;
  description?: string[] | string;
  link?: string;
  linkLabel?: string;
};

const MAX_GITHUB_FILES = 36;
const MAX_FILE_CHARS = 12000;
const MAX_TOTAL_CHARS = 180000;

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".html",
  ".css",
  ".scss",
  ".less",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".vue",
  ".svelte",
  ".java",
  ".kt",
  ".kts",
  ".py",
  ".go",
  ".rs",
  ".cs",
  ".php",
  ".rb",
  ".swift",
  ".sql",
  ".gradle",
  ".properties",
  ".env.example",
]);

const IMPORTANT_FILES = new Set([
  "readme.md",
  "readme.mdx",
  "package.json",
  "pnpm-workspace.yaml",
  "vite.config.ts",
  "next.config.js",
  "pom.xml",
  "build.gradle",
  "settings.gradle",
  "dockerfile",
  "docker-compose.yml",
  "compose.yml",
  "requirements.txt",
  "pyproject.toml",
  "cargo.toml",
  "go.mod",
]);

const EXCLUDED_PATH_PARTS = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".vercel",
  ".idea",
  ".vscode",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "target",
  "vendor",
  "__pycache__",
]);

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

const createErrorResponse = (error: string, status = 400) =>
  Response.json(
    {
      ok: false,
      error,
    },
    { status }
  );

const getPathExtension = (path: string) => {
  const lower = path.toLowerCase();
  const fileName = lower.split("/").pop() || lower;
  if (fileName === ".env.example") return ".env.example";
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex) : "";
};

const isExcludedPath = (path: string) =>
  path
    .split("/")
    .map((part) => part.toLowerCase())
    .some((part) => EXCLUDED_PATH_PARTS.has(part));

const isTextLikePath = (path: string) => {
  const fileName = path.toLowerCase().split("/").pop() || "";
  return IMPORTANT_FILES.has(fileName) || TEXT_EXTENSIONS.has(getPathExtension(path));
};

const scorePath = (path: string) => {
  const lower = path.toLowerCase();
  const fileName = lower.split("/").pop() || lower;
  let score = 0;

  if (IMPORTANT_FILES.has(fileName)) score += 120;
  if (fileName.startsWith("readme")) score += 80;
  if (lower.includes("/src/")) score += 35;
  if (lower.includes("/app/") || lower.includes("/pages/")) score += 24;
  if (lower.includes("/routes/") || lower.includes("/controllers/")) score += 18;
  if (lower.includes("/components/")) score += 12;
  if (lower.includes("/test") || lower.includes(".test.") || lower.includes(".spec.")) {
    score -= 30;
  }
  if (lower.includes("lock")) score -= 70;

  return score;
};

const normalizeFiles = (files?: SourceFile[]) => {
  if (!Array.isArray(files)) return [];

  let totalChars = 0;
  return files
    .filter((file) => file?.path && typeof file.content === "string")
    .filter((file) => !isExcludedPath(file.path) && isTextLikePath(file.path))
    .sort((a, b) => scorePath(b.path) - scorePath(a.path))
    .slice(0, MAX_GITHUB_FILES)
    .flatMap((file) => {
      if (totalChars >= MAX_TOTAL_CHARS) return [];
      const content = file.content.slice(0, Math.min(MAX_FILE_CHARS, MAX_TOTAL_CHARS - totalChars));
      totalChars += content.length;
      return [
        {
          path: file.path,
          content,
        },
      ];
    });
};

const buildSnapshotText = (files: SourceFile[], sourceLabel: string) => {
  const blocks = files.map(
    (file) => `### ${file.path}\n\`\`\`\n${file.content}\n\`\`\``
  );
  return [`项目来源：${sourceLabel}`, ...blocks].join("\n\n");
};

const parseGithubUrl = (url: string) => {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com") {
      return null;
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;

    return {
      owner: parts[0],
      repo: parts[1].replace(/\.git$/i, ""),
      branch: parts[2] === "tree" && parts[3] ? parts[3] : undefined,
      subPath:
        parts[2] === "tree" && parts.length > 4
          ? parts.slice(4).join("/")
          : "",
    };
  } catch {
    return null;
  }
};

const githubFetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "magic-resume-project-writer",
    },
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(parseUpstreamError(raw, `GitHub 请求失败：${response.status}`));
  }

  return JSON.parse(raw) as T;
};

const fetchGithubFiles = async (githubUrl: string) => {
  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) {
    throw new Error("请输入有效的 GitHub 仓库地址。");
  }

  const repoInfo = await githubFetchJson<{
    name: string;
    full_name: string;
    description?: string;
    default_branch: string;
    homepage?: string;
    html_url?: string;
    topics?: string[];
  }>(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`);

  const branch = parsed.branch || repoInfo.default_branch;
  const tree = await githubFetchJson<{
    tree?: Array<{ path: string; type: string; size?: number }>;
  }>(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );

  const subPathPrefix = parsed.subPath ? `${parsed.subPath.replace(/\/+$/, "")}/` : "";
  const candidates = (tree.tree || [])
    .filter((item) => item.type === "blob" && item.path)
    .filter((item) => !subPathPrefix || item.path === parsed.subPath || item.path.startsWith(subPathPrefix))
    .filter((item) => !isExcludedPath(item.path) && isTextLikePath(item.path))
    .filter((item) => typeof item.size !== "number" || item.size <= 180000)
    .sort((a, b) => scorePath(b.path) - scorePath(a.path))
    .slice(0, MAX_GITHUB_FILES);

  const files: SourceFile[] = [];
  let totalChars = 0;

  for (const item of candidates) {
    if (totalChars >= MAX_TOTAL_CHARS) break;

    const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${encodeURIComponent(branch)}/${item.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    const response = await fetch(rawUrl, {
      headers: {
        "User-Agent": "magic-resume-project-writer",
      },
    });

    if (!response.ok) continue;

    const text = await response.text();
    const content = text.slice(0, Math.min(MAX_FILE_CHARS, MAX_TOTAL_CHARS - totalChars));
    totalChars += content.length;
    files.push({
      path: item.path,
      content,
    });
  }

  if (repoInfo.description) {
    files.unshift({
      path: "GITHUB_REPOSITORY_SUMMARY.md",
      content: [
        `# ${repoInfo.full_name}`,
        repoInfo.description,
        repoInfo.homepage ? `Homepage: ${repoInfo.homepage}` : "",
        repoInfo.topics?.length ? `Topics: ${repoInfo.topics.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  return {
    files: normalizeFiles(files),
    label: repoInfo.full_name,
    link: repoInfo.html_url || githubUrl,
  };
};

const normalizeProjectDraft = (draft: ProjectDraft) => {
  const rawDescription = Array.isArray(draft.description)
    ? draft.description
    : typeof draft.description === "string"
      ? draft.description
          .split(/\r?\n/)
          .map((item) => item.replace(/^[-*]\s*/, "").trim())
      : [];

  const description = rawDescription
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    name: String(draft.name || "").trim(),
    role: String(draft.role || "").trim(),
    date: String(draft.date || "").trim(),
    description,
    link: String(draft.link || "").trim(),
    linkLabel: String(draft.linkLabel || "").trim(),
  };
};

const createSystemInstruction = (language: string) => `你是资深技术简历顾问。你会阅读项目仓库的关键文件，并为“项目经历”模块生成一条可直接放入简历的结构化内容。

输出要求：
1. 只输出合法 JSON 对象，不要 Markdown，不要解释。
2. 必须使用 ${language}。
3. 内容要基于仓库证据，不要编造不存在的指标、用户量、收益或公司名称。
4. 如果用户提供了应聘方向/目标岗位，必须优先筛选与该岗位匹配的项目亮点，并用该岗位的专业语言表达。
5. 例如目标岗位是测试工程师时，优先突出测试策略、测试用例设计、接口/自动化测试、缺陷定位、质量保障、CI/CD 测试集成、稳定性和可观测性，而不是泛泛描述开发功能。
6. description 输出 3 到 5 条项目亮点，每条一句话，突出岗位匹配度、业务价值、技术方案、个人贡献、工程能力。
7. 语气专业、简洁，适合简历；避免“我”“本人”等第一人称。

JSON 结构：
{
  "name": "项目名称",
  "role": "项目角色或职责",
  "date": "项目时间，不确定则留空",
  "description": ["项目亮点1", "项目亮点2", "项目亮点3"],
  "link": "项目链接，不确定则留空",
  "linkLabel": "链接显示文字，不确定则留空"
}`;

export const Route = createFileRoute("/api/project-write")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const {
            apiKey,
            model,
            modelType = "gemini",
            apiEndpoint,
            sourceType,
            githubUrl,
            files,
            currentProject,
            targetRole,
            jobDescription,
            customInstructions,
            locale,
          } = body as {
            apiKey?: string;
            model?: string;
            modelType?: AIModelType;
            apiEndpoint?: string;
            sourceType?: "local" | "github";
            githubUrl?: string;
            files?: SourceFile[];
            currentProject?: ProjectDraft;
            targetRole?: string;
            jobDescription?: string;
            customInstructions?: string;
            locale?: string;
          };

          const modelConfig = AI_MODEL_CONFIGS[modelType];
          if (!modelConfig) {
            return createErrorResponse("无效的 AI 服务商。");
          }

          if (!apiKey || !model) {
            return createErrorResponse("请先完整配置 AI 服务商 API Key 和模型 ID。");
          }

          let sourceFiles: SourceFile[] = [];
          let sourceLabel = "Local project";
          let inferredLink = "";

          if (sourceType === "github") {
            if (!githubUrl) {
              return createErrorResponse("请输入 GitHub 仓库地址。");
            }
            const githubSnapshot = await fetchGithubFiles(githubUrl);
            sourceFiles = githubSnapshot.files;
            sourceLabel = githubSnapshot.label;
            inferredLink = githubSnapshot.link;
          } else {
            sourceFiles = normalizeFiles(files);
            sourceLabel = "Local project directory";
          }

          if (sourceFiles.length === 0) {
            return createErrorResponse("未读取到可分析的项目文本文件。");
          }

          const language = locale === "en" ? "English" : "Chinese";
          const systemInstruction = createSystemInstruction(language);
          const userContent = [
            "请根据以下仓库内容生成简历项目经历。",
            currentProject
              ? `当前项目表单内容：\n${JSON.stringify(currentProject, null, 2)}`
              : "",
            targetRole?.trim()
              ? `应聘方向/目标岗位：${targetRole.trim()}\n请让项目经历明显服务于该岗位方向，优先保留与该岗位相关的能力证据。`
              : "",
            jobDescription?.trim()
              ? `岗位 JD 上下文：\n${jobDescription.trim()}\n请优先对齐 JD 中的硬技能、工具链、质量要求和岗位职责。`
              : "",
            inferredLink ? `项目链接：${inferredLink}` : "",
            customInstructions?.trim()
              ? `用户额外要求：\n${customInstructions.trim()}`
              : "",
            buildSnapshotText(sourceFiles, sourceLabel),
          ]
            .filter(Boolean)
            .join("\n\n");

          let aiContent = "";

          if (modelType === "gemini") {
            const modelInstance = getGeminiModelInstance({
              apiKey,
              model,
              systemInstruction,
              generationConfig: {
                temperature: 0.25,
                responseMimeType: "application/json",
              },
            });

            const result = await modelInstance.generateContent(userContent);
            aiContent = result.response.text();
          } else {
            const requestUrl = modelConfig.url(apiEndpoint);
            if (!requestUrl.startsWith("http")) {
              return createErrorResponse("API Endpoint 配置无效，请检查 AI 服务商设置。");
            }

            const response = await fetch(requestUrl, {
              method: "POST",
              headers: modelConfig.headers(apiKey),
              body: JSON.stringify({
                model: modelConfig.requiresModelId ? model : modelConfig.defaultModel,
                temperature: 0.25,
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
              return createErrorResponse(
                parseUpstreamError(
                  raw,
                  `AI 服务商请求失败：${response.status} ${response.statusText}`
                ),
                response.status
              );
            }

            const data = raw ? JSON.parse(raw) : {};
            aiContent = data?.choices?.[0]?.message?.content || "";
          }

          const parsed = aiContent ? parseJsonPayload(aiContent) : null;
          if (!parsed) {
            return createErrorResponse("AI 未返回有效的项目经历 JSON。", 502);
          }

          const project = normalizeProjectDraft({
            ...parsed,
            link: parsed.link || inferredLink,
            linkLabel: parsed.linkLabel || (inferredLink ? "GitHub" : ""),
          });

          return Response.json({
            ok: true,
            project,
            source: {
              label: sourceLabel,
              fileCount: sourceFiles.length,
            },
          });
        } catch (error) {
          console.error("Project write error:", error);
          return createErrorResponse(
            error instanceof Error ? error.message : formatGeminiErrorMessage(error),
            500
          );
        }
      },
    },
  },
});

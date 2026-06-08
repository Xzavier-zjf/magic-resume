import {
  KeywordMatch,
  ResumeAnalysis,
  ResumeData,
  ResumeRewriteSuggestion,
} from "@/types/resume";
import { generateUUID } from "@/utils/uuid";

const ROLE_KEYWORDS: Record<string, string[]> = {
  qa: [
    "测试",
    "测试用例",
    "自动化测试",
    "接口测试",
    "性能测试",
    "缺陷",
    "质量",
    "回归",
    "pytest",
    "selenium",
    "playwright",
    "postman",
    "jmeter",
    "ci/cd",
  ],
  frontend: [
    "react",
    "vue",
    "typescript",
    "javascript",
    "css",
    "前端",
    "组件",
    "性能优化",
    "工程化",
    "vite",
    "webpack",
  ],
  backend: [
    "java",
    "spring",
    "spring boot",
    "mysql",
    "redis",
    "接口",
    "微服务",
    "数据库",
    "并发",
    "缓存",
  ],
  devops: [
    "docker",
    "kubernetes",
    "linux",
    "ci/cd",
    "监控",
    "部署",
    "自动化",
    "日志",
    "运维",
  ],
  product: ["需求", "原型", "用户", "竞品", "数据分析", "prd", "产品", "迭代"],
};

const GENERAL_SKILLS = [
  "react",
  "vue",
  "typescript",
  "javascript",
  "node",
  "java",
  "spring",
  "python",
  "mysql",
  "redis",
  "docker",
  "kubernetes",
  "git",
  "linux",
  "测试",
  "自动化测试",
  "接口测试",
  "性能优化",
  "ci/cd",
  "敏捷",
  "需求分析",
  "项目管理",
];

const QUALITY_WORDS = [
  "优化",
  "提升",
  "降低",
  "减少",
  "负责",
  "主导",
  "设计",
  "落地",
  "排查",
  "定位",
  "稳定性",
  "可用性",
  "效率",
];

const normalizeText = (text?: string) =>
  (text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

const unique = (items: string[]) =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const includesKeyword = (text: string, keyword: string) => {
  const lower = keyword.trim().toLowerCase();
  if (!lower) return false;

  if (/^[a-z0-9+#./-]+$/i.test(lower)) {
    return new RegExp(
      `(^|[^a-z0-9+#./-])${escapeRegExp(lower)}($|[^a-z0-9+#./-])`,
      "i"
    ).test(text);
  }

  return text.includes(lower);
};

const inferRoleKey = (targetRole: string, jd: string) => {
  const text = `${targetRole} ${jd}`.toLowerCase();
  if (/测试|qa|quality|sdet|自动化/.test(text)) return "qa";
  if (/前端|frontend|react|vue/.test(text)) return "frontend";
  if (/后端|backend|java|spring|服务端/.test(text)) return "backend";
  if (/运维|devops|kubernetes|docker|linux/.test(text)) return "devops";
  if (/产品|product|prd|需求/.test(text)) return "product";
  return "";
};

export const getResumePlainText = (resume: ResumeData) => {
  const customText = Object.values(resume.customData || {})
    .flat()
    .map((item) => [item.title, item.subtitle, item.dateRange, item.description].join(" "))
    .join(" ");

  return normalizeText(
    [
      resume.title,
      resume.versionName,
      resume.targetRole,
      resume.basic?.name,
      resume.basic?.title,
      resume.basic?.employementStatus,
      resume.basic?.location,
      resume.skillContent,
      resume.selfEvaluationContent,
      ...(resume.education || []).map((item) =>
        [item.school, item.major, item.degree, item.description].join(" ")
      ),
      ...(resume.experience || []).map((item) =>
        [item.company, item.position, item.date, item.details].join(" ")
      ),
      ...(resume.projects || []).map((item) =>
        [item.name, item.role, item.date, item.description].join(" ")
      ),
      customText,
    ].join(" ")
  );
};

const extractJdKeywords = (jd: string, targetRole: string) => {
  const normalizedJd = normalizeText(jd);
  const roleKey = inferRoleKey(targetRole, normalizedJd);
  const roleKeywords = roleKey ? ROLE_KEYWORDS[roleKey] || [] : [];

  const explicitSkills = GENERAL_SKILLS.filter((keyword) =>
    includesKeyword(normalizedJd, keyword)
  );

  const englishTokens = (normalizedJd.match(/[a-z][a-z0-9+#./-]{1,}/g) || [])
    .filter((token) => token.length >= 3)
    .filter((token) => !["and", "the", "with", "for", "you", "are", "our"].includes(token));

  const chineseTokens = (normalizedJd.match(/[\u4e00-\u9fa5]{2,8}/g) || [])
    .filter((token) => /开发|测试|设计|经验|熟悉|掌握|负责|优化|自动化|接口|项目|数据|质量|需求/.test(token));

  return unique([...roleKeywords, ...explicitSkills, ...englishTokens, ...chineseTokens]).slice(0, 34);
};

const buildKeywordMatches = (
  keywords: string[],
  resumeText: string,
  targetRole: string
): KeywordMatch[] => {
  const roleKey = inferRoleKey(targetRole, "");
  const roleKeywords = roleKey ? ROLE_KEYWORDS[roleKey] || [] : [];

  return keywords.map((keyword) => {
    const lower = keyword.toLowerCase();
    const category = GENERAL_SKILLS.includes(lower)
      ? "skill"
      : roleKeywords.some((item) => item.toLowerCase() === lower)
        ? "role"
        : QUALITY_WORDS.some((item) => lower.includes(item))
          ? "quality"
          : /docker|git|mysql|redis|postman|jmeter|playwright|selenium|linux/.test(lower)
            ? "tool"
            : "general";

    return {
      keyword,
      matched: includesKeyword(resumeText, lower),
      category,
    };
  });
};

const scoreAts = (resume: ResumeData, resumeText: string, locale = "zh") => {
  let score = 35;
  const risks: string[] = [];
  const isEn = locale === "en";

  if (resume.basic?.email) score += 10;
  else risks.push(isEn ? "Email is missing, which makes ATS and recruiter contact harder." : "缺少邮箱，ATS 和招聘方难以联系候选人。");

  if (resume.basic?.phone) score += 10;
  else risks.push(isEn ? "Phone number is missing. Add a direct contact channel." : "缺少手机号，建议补充可直接联系的信息。");

  if (resume.skillContent && normalizeText(resume.skillContent).length > 20) score += 12;
  else risks.push(isEn ? "The skills section is too thin. Add skill keywords aligned with the JD." : "专业技能内容偏少，建议补充与 JD 对齐的技能关键词。");

  if ((resume.projects || []).some((project) => normalizeText(project.description).length > 40)) {
    score += 12;
  } else {
    risks.push(isEn ? "Project descriptions are too brief. Add responsibility, approach, and outcome." : "项目经历描述偏少，建议补充职责、技术方案和结果。");
  }

  if ((resume.experience || []).length > 0 || (resume.projects || []).length > 0) score += 10;
  if (/\d+%|\d+\s*(ms|秒|分钟|人|个|次|万|k|w)/i.test(resumeText)) score += 11;
  else risks.push(isEn ? "Measurable outcomes are limited. Add metrics such as coverage, defects, performance, or efficiency gains." : "量化结果不足，可加入覆盖率、缺陷数、性能提升、效率提升等指标。");

  return {
    score: clampScore(score),
    risks,
  };
};

export const analyzeResumeLocally = ({
  resume,
  jobDescription,
  targetRole,
  locale = "zh",
}: {
  resume: ResumeData;
  jobDescription: string;
  targetRole: string;
  locale?: string;
}): ResumeAnalysis => {
  const resumeText = getResumePlainText(resume);
  const keywords = extractJdKeywords(jobDescription, targetRole);
  const keywordMatches = buildKeywordMatches(keywords, resumeText, targetRole);
  const matchedKeywords = keywordMatches.filter((item) => item.matched);
  const missingKeywords = keywordMatches
    .filter((item) => !item.matched)
    .map((item) => item.keyword)
    .slice(0, 12);

  const keywordScore = keywords.length
    ? clampScore((matchedKeywords.length / keywords.length) * 100)
    : 60;

  const skillKeywords = keywordMatches.filter((item) => item.category === "skill" || item.category === "tool");
  const skillScore = skillKeywords.length
    ? clampScore(
        (skillKeywords.filter((item) => item.matched).length / skillKeywords.length) * 100
      )
    : clampScore(keywordScore * 0.85 + 10);

  const projectText = normalizeText((resume.projects || []).map((item) => item.description).join(" "));
  const projectMatched = keywords.filter((keyword) =>
    includesKeyword(projectText, keyword)
  ).length;
  const projectScore = keywords.length
    ? clampScore((projectMatched / Math.min(keywords.length, 12)) * 100)
    : 55;

  const ats = scoreAts(resume, resumeText, locale);
  const overallScore = clampScore(
    keywordScore * 0.34 + skillScore * 0.24 + projectScore * 0.22 + ats.score * 0.2
  );

  const isEn = locale === "en";
  const suggestions = [
    missingKeywords.length
      ? isEn
        ? `Add or strengthen missing JD keywords: ${missingKeywords.slice(0, 6).join(", ")}.`
        : `补充或强化 JD 缺失关键词：${missingKeywords.slice(0, 6).join("、")}。`
      : isEn
        ? "Keyword coverage is healthy. Keep the wording close to the JD."
        : "关键词覆盖较好，建议保留与 JD 接近的表达。",
    isEn
      ? "Make project bullets follow action + method + measurable result."
      : "项目经历建议采用“动作 + 方法 + 量化结果”的表述。",
    isEn
      ? "Keep section titles standard so ATS can parse them reliably."
      : "保持模块标题标准化，提升 ATS 解析稳定性。",
  ];

  const rewrites: ResumeRewriteSuggestion[] = missingKeywords.slice(0, 3).map((keyword) => ({
    section: "projects",
    title: isEn ? `Add evidence for ${keyword}` : `补充 ${keyword} 相关证据`,
    after: isEn
      ? `Add a project bullet that demonstrates ${keyword} with concrete scope, tools, and result.`
      : `在项目经历中补充与“${keyword}”相关的职责、工具和结果，避免只罗列技能词。`,
  }));

  return {
    id: generateUUID(),
    resumeId: resume.id,
    targetRole,
    jobDescription,
    createdAt: new Date().toISOString(),
    overallScore,
    keywordScore,
    skillScore,
    projectScore,
    atsScore: ats.score,
    keywords: keywordMatches,
    missingKeywords,
    strengths: [
      isEn
        ? `${matchedKeywords.length} JD keywords are already covered.`
        : `已覆盖 ${matchedKeywords.length} 个 JD 关键词。`,
      resume.projects?.length
        ? isEn
          ? "Project experience is available for role-focused rewriting."
          : "已有项目经历，可进一步按岗位方向重写。"
        : isEn
          ? "Add project experience to improve matching."
          : "建议补充项目经历以提升匹配度。",
    ],
    risks: ats.risks,
    suggestions,
    rewrites,
    summary: isEn
      ? "Local rule analysis completed. Use AI enhancement for more tailored rewrites."
      : "本地规则分析已完成，可使用 AI 增强获得更贴合岗位的改写建议。",
    aiEnhanced: false,
  };
};

export const mergeAiAnalysis = (
  base: ResumeAnalysis,
  ai: Partial<ResumeAnalysis>
): ResumeAnalysis => ({
  ...base,
  ...ai,
  id: base.id,
  resumeId: base.resumeId,
  targetRole: base.targetRole,
  jobDescription: base.jobDescription,
  createdAt: base.createdAt,
  keywords: ai.keywords?.length ? ai.keywords : base.keywords,
  missingKeywords: ai.missingKeywords?.length ? ai.missingKeywords : base.missingKeywords,
  strengths: ai.strengths?.length ? ai.strengths : base.strengths,
  risks: ai.risks?.length ? ai.risks : base.risks,
  suggestions: ai.suggestions?.length ? ai.suggestions : base.suggestions,
  rewrites: ai.rewrites?.length ? ai.rewrites : base.rewrites,
  aiEnhanced: true,
});

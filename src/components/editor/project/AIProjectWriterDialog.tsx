import { useMemo, useState } from "react";
import { FolderOpen, Github, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/i18n/compat/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AI_MODEL_CONFIGS } from "@/config/ai";
import { cn } from "@/lib/utils";
import { useAIConfigStore } from "@/store/useAIConfigStore";
import { useResumeStore } from "@/store/useResumeStore";
import { Project } from "@/types/resume";

type SourceFile = {
  path: string;
  content: string;
};

type GeneratedProject = {
  name: string;
  role: string;
  date: string;
  description: string[];
  link: string;
  linkLabel: string;
};

interface AIProjectWriterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onApply: (project: Project) => void;
}

const MAX_LOCAL_FILES = 36;
const MAX_FILE_CHARS = 12000;
const MAX_TOTAL_CHARS = 180000;

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

const getCurrentLocale = () => {
  if (typeof document === "undefined") return "zh";
  return (
    document.cookie
      .split("; ")
      .find((row) => row.startsWith("NEXT_LOCALE="))
      ?.split("=")[1] || "zh"
  );
};

const convertDescriptionToHtml = (items: string[]) => {
  const safeItems = items.map((item) => item.trim()).filter(Boolean);
  if (safeItems.length === 0) return "";

  return `<ul>${safeItems
    .map((item) => `<li><p>${escapeHtml(item)}</p></li>`)
    .join("")}</ul>`;
};

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const readDirectoryFiles = async () => {
  const picker = (window as unknown as {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;

  if (!picker) {
    throw new Error("当前浏览器不支持选择本地目录，请使用 Chrome 或 Edge。");
  }

  const rootHandle = await picker();
  const candidates: Array<{ path: string; file: File }> = [];

  const walk = async (
    directory: FileSystemDirectoryHandle,
    prefix = "",
    depth = 0
  ) => {
    if (depth > 4 || candidates.length >= MAX_LOCAL_FILES * 3) return;

    for await (const [name, handle] of directory.entries()) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (isExcludedPath(path)) continue;

      if (handle.kind === "directory") {
        await walk(handle, path, depth + 1);
        continue;
      }

      if (!isTextLikePath(path)) continue;

      const file = await handle.getFile();
      if (file.size > 180000) continue;

      candidates.push({ path, file });
    }
  };

  await walk(rootHandle);

  let totalChars = 0;
  const files: SourceFile[] = [];

  for (const candidate of candidates
    .sort((a, b) => scorePath(b.path) - scorePath(a.path))
    .slice(0, MAX_LOCAL_FILES)) {
    if (totalChars >= MAX_TOTAL_CHARS) break;
    const text = await candidate.file.text();
    const content = text.slice(
      0,
      Math.min(MAX_FILE_CHARS, MAX_TOTAL_CHARS - totalChars)
    );
    totalChars += content.length;
    files.push({
      path: candidate.path,
      content,
    });
  }

  return {
    directoryName: rootHandle.name,
    files,
  };
};

export default function AIProjectWriterDialog({
  open,
  onOpenChange,
  project,
  onApply,
}: AIProjectWriterDialogProps) {
  const t = useTranslations("workbench.projectItem.aiWriter");
  const { activeResume } = useResumeStore();
  const [sourceType, setSourceType] = useState<"local" | "github">("local");
  const [githubUrl, setGithubUrl] = useState(project.link || "");
  const [targetRole, setTargetRole] = useState(activeResume?.basic?.title || "");
  const [customInstructions, setCustomInstructions] = useState("");
  const [localFiles, setLocalFiles] = useState<SourceFile[]>([]);
  const [localDirectoryName, setLocalDirectoryName] = useState("");
  const [isReadingLocal, setIsReadingLocal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedProject, setGeneratedProject] = useState<GeneratedProject | null>(null);

  const {
    selectedModel,
    doubaoApiKey,
    doubaoModelId,
    deepseekApiKey,
    deepseekModelId,
    openaiApiKey,
    openaiModelId,
    openaiApiEndpoint,
    geminiApiKey,
    geminiModelId,
    getSelectedProviderModel,
    getSelectedCustomModel,
    isConfigured,
  } = useAIConfigStore();

  const selectedFileLabel = useMemo(() => {
    if (!localFiles.length) return t("local.empty");
    return t("local.selected", {
      count: localFiles.length,
      name: localDirectoryName || t("local.directory"),
    });
  }, [localDirectoryName, localFiles.length, t]);

  const getAIRequestConfig = () => {
    const config = AI_MODEL_CONFIGS[selectedModel];
    const providerModel = getSelectedProviderModel();
    const customModel = getSelectedCustomModel();
    const fallbackApiKey =
      selectedModel === "doubao"
        ? doubaoApiKey
        : selectedModel === "openai"
          ? openaiApiKey
          : selectedModel === "gemini"
            ? geminiApiKey
            : selectedModel === "custom"
              ? customModel?.apiKey || ""
              : deepseekApiKey;
    const fallbackModelId =
      selectedModel === "doubao"
        ? doubaoModelId
        : selectedModel === "openai"
          ? openaiModelId
          : selectedModel === "gemini"
            ? geminiModelId
            : selectedModel === "custom"
              ? customModel?.modelId || ""
              : deepseekModelId;
    const fallbackApiEndpoint =
      selectedModel === "openai"
        ? openaiApiEndpoint
        : selectedModel === "custom"
          ? customModel?.apiEndpoint
          : undefined;

    return {
      config,
      apiKey: providerModel?.apiKey || fallbackApiKey,
      modelId: providerModel?.modelId || fallbackModelId,
      apiEndpoint: providerModel?.apiEndpoint || fallbackApiEndpoint,
    };
  };

  const handleSelectLocalDirectory = async () => {
    try {
      setIsReadingLocal(true);
      const result = await readDirectoryFiles();
      setLocalDirectoryName(result.directoryName);
      setLocalFiles(result.files);
      if (result.files.length === 0) {
        toast.warning(t("toast.noLocalFiles"));
      } else {
        toast.success(t("toast.localLoaded", { count: result.files.length }));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast.error(error instanceof Error ? error.message : t("toast.localFailed"));
    } finally {
      setIsReadingLocal(false);
    }
  };

  const handleGenerate = async () => {
    try {
      if (!isConfigured()) {
        toast.error(t("toast.configRequired"));
        return;
      }

      if (sourceType === "local" && localFiles.length === 0) {
        toast.error(t("toast.selectLocal"));
        return;
      }

      if (sourceType === "github" && !githubUrl.trim()) {
        toast.error(t("toast.githubRequired"));
        return;
      }

      setIsGenerating(true);
      setGeneratedProject(null);

      const { config, apiKey, modelId, apiEndpoint } = getAIRequestConfig();

      const response = await fetch("/api/project-write", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey,
          apiEndpoint,
          model: config.requiresModelId ? modelId : config.defaultModel,
          modelType: selectedModel,
          sourceType,
          githubUrl: githubUrl.trim() || undefined,
          files: sourceType === "local" ? localFiles : undefined,
          currentProject: project,
          targetRole: targetRole.trim() || undefined,
          customInstructions: customInstructions.trim() || undefined,
          locale: getCurrentLocale(),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || t("toast.generateFailed"));
      }

      setGeneratedProject(data.project);
      toast.success(t("toast.generated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.generateFailed"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (!generatedProject) return;

    onApply({
      ...project,
      name: generatedProject.name || project.name,
      role: generatedProject.role || project.role,
      date: generatedProject.date || project.date,
      description:
        generatedProject.description?.length
          ? convertDescriptionToHtml(generatedProject.description)
          : project.description,
      link: generatedProject.link || project.link,
      linkLabel: generatedProject.linkLabel || project.linkLabel,
    });
    toast.success(t("toast.applied"));
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isGenerating || isReadingLocal) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr,1fr]">
          <div className="space-y-4">
            <Tabs
              value={sourceType}
              onValueChange={(value) => setSourceType(value as "local" | "github")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="local" className="gap-2">
                  <FolderOpen className="h-4 w-4" />
                  {t("tabs.local")}
                </TabsTrigger>
                <TabsTrigger value="github" className="gap-2">
                  <Github className="h-4 w-4" />
                  {t("tabs.github")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="local" className="space-y-3">
                <div className="rounded-lg border border-dashed border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{selectedFileLabel}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t("local.hint")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSelectLocalDirectory}
                      disabled={isReadingLocal || isGenerating}
                      className="shrink-0"
                    >
                      {isReadingLocal ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FolderOpen className="mr-2 h-4 w-4" />
                      )}
                      {t("local.select")}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="github" className="space-y-2">
                <Label htmlFor="project-github-url">{t("github.label")}</Label>
                <Input
                  id="project-github-url"
                  value={githubUrl}
                  onChange={(event) => setGithubUrl(event.target.value)}
                  placeholder={t("github.placeholder")}
                  disabled={isGenerating}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("github.hint")}
                </p>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label htmlFor="project-target-role">
                {t("targetRole.label")}
              </Label>
              <Input
                id="project-target-role"
                value={targetRole}
                onChange={(event) => setTargetRole(event.target.value)}
                placeholder={t("targetRole.placeholder")}
                disabled={isGenerating}
              />
              <p className="text-xs leading-5 text-muted-foreground">
                {t("targetRole.hint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-ai-instructions">
                {t("instructions.label")}
              </Label>
              <Textarea
                id="project-ai-instructions"
                value={customInstructions}
                onChange={(event) => setCustomInstructions(event.target.value)}
                placeholder={t("instructions.placeholder")}
                disabled={isGenerating}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("preview.title")}</Label>
              {generatedProject && (
                <span className="text-xs text-muted-foreground">
                  {generatedProject.description.length} {t("preview.items")}
                </span>
              )}
            </div>
            <div
              className={cn(
                "min-h-[310px] rounded-lg border bg-muted/20 p-4",
                "text-sm leading-6"
              )}
            >
              {generatedProject ? (
                <div className="space-y-3">
                  <div>
                    <div className="font-semibold">
                      {generatedProject.name || t("preview.untitled")}
                    </div>
                    <div className="text-muted-foreground">
                      {generatedProject.role}
                    </div>
                  </div>
                  {generatedProject.date && (
                    <div className="text-xs text-muted-foreground">
                      {generatedProject.date}
                    </div>
                  )}
                  <ul className="list-disc space-y-1 pl-5">
                    {generatedProject.description.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                  {generatedProject.link && (
                    <div className="text-xs text-muted-foreground break-all">
                      {generatedProject.linkLabel || "Link"}: {generatedProject.link}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center text-center text-muted-foreground">
                  {isGenerating ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("preview.generating")}
                    </div>
                  ) : (
                    t("preview.empty")
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating || isReadingLocal}
          >
            {t("actions.cancel")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleGenerate}
            disabled={isGenerating || isReadingLocal}
          >
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {generatedProject ? t("actions.regenerate") : t("actions.generate")}
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!generatedProject || isGenerating || isReadingLocal}
          >
            {t("actions.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

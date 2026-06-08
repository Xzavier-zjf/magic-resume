import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  CopyPlus,
  Loader2,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "@/i18n/compat/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AI_MODEL_CONFIGS } from "@/config/ai";
import {
  getTargetRoleLabel,
  getTargetRoleValue,
  TARGET_ROLE_PRESETS,
} from "@/config/targetRoles";
import { analyzeResumeLocally } from "@/lib/resumeAnalysis";
import { useRouter } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useAIConfigStore } from "@/store/useAIConfigStore";
import { useResumeStore } from "@/store/useResumeStore";
import { ResumeAnalysis } from "@/types/resume";

const scoreTone = (score: number) => {
  if (score >= 85) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (score >= 70) return "text-blue-600 bg-blue-50 border-blue-200";
  if (score >= 55) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
};

const getScoreItems = (
  analysis: ResumeAnalysis,
  t: ReturnType<typeof useTranslations>
) => [
  {
    key: "overall",
    label: t("dashboard.analyze.scores.overall"),
    value: analysis.overallScore,
  },
  {
    key: "keyword",
    label: t("dashboard.analyze.scores.keyword"),
    value: analysis.keywordScore,
  },
  {
    key: "skill",
    label: t("dashboard.analyze.scores.skill"),
    value: analysis.skillScore,
  },
  {
    key: "project",
    label: t("dashboard.analyze.scores.project"),
    value: analysis.projectScore,
  },
  {
    key: "ats",
    label: t("dashboard.analyze.scores.ats"),
    value: analysis.atsScore,
  },
];

const resolveRolePresetValue = (value: string, locale: string) => {
  if (value === "custom") return "";
  const preset = TARGET_ROLE_PRESETS.find((item) => item.id === value);
  return preset ? getTargetRoleValue(preset, locale) : value;
};

const findRolePresetId = (role: string, locale: string) => {
  const normalizedRole = role.trim();
  const preset = TARGET_ROLE_PRESETS.find(
    (item) => getTargetRoleValue(item, locale) === normalizedRole
  );
  return preset?.id || "custom";
};

const getConfiguredAIRequest = () => {
  const state = useAIConfigStore.getState();
  const selectedModel = state.selectedModel;
  const config = AI_MODEL_CONFIGS[selectedModel];
  const providerModel = state.getSelectedProviderModel();
  const customModel = state.getSelectedCustomModel();
  const fallbackApiKey =
    selectedModel === "doubao"
      ? state.doubaoApiKey
      : selectedModel === "openai"
        ? state.openaiApiKey
        : selectedModel === "gemini"
          ? state.geminiApiKey
          : selectedModel === "custom"
            ? customModel?.apiKey || ""
            : state.deepseekApiKey;
  const fallbackModelId =
    selectedModel === "doubao"
      ? state.doubaoModelId
      : selectedModel === "openai"
        ? state.openaiModelId
        : selectedModel === "gemini"
          ? state.geminiModelId
          : selectedModel === "custom"
            ? customModel?.modelId || ""
            : state.deepseekModelId;
  const fallbackApiEndpoint =
    selectedModel === "openai"
      ? state.openaiApiEndpoint
      : selectedModel === "custom"
        ? customModel?.apiEndpoint
        : undefined;

  return {
    config,
    selectedModel,
    apiKey: providerModel?.apiKey || fallbackApiKey,
    modelId: providerModel?.modelId || fallbackModelId,
    apiEndpoint: providerModel?.apiEndpoint || fallbackApiEndpoint,
  };
};

const AnalyzePage = () => {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { resumes, createResumeVersion, updateResumeAnalysis, setActiveResume } =
    useResumeStore();
  const aiConfigured = useAIConfigStore((state) => state.isConfigured());
  const resumeList = useMemo(
    () =>
      Object.values(resumes).sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
      ),
    [resumes]
  );
  const [selectedResumeId, setSelectedResumeId] = useState(resumeList[0]?.id || "");
  const [rolePreset, setRolePreset] = useState("qa");
  const [targetRole, setTargetRole] = useState(
    getTargetRoleValue(TARGET_ROLE_PRESETS[0], locale)
  );
  const [jobDescription, setJobDescription] = useState("");
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAiEnhancing, setIsAiEnhancing] = useState(false);

  const selectedResume = selectedResumeId ? resumes[selectedResumeId] : undefined;

  useEffect(() => {
    if (selectedResumeId && resumes[selectedResumeId]) {
      return;
    }

    const nextResumeId = resumeList[0]?.id || "";
    if (selectedResumeId !== nextResumeId) {
      setSelectedResumeId(nextResumeId);
    }

    if (!nextResumeId) {
      setAnalysis(null);
      setJobDescription("");
    }
  }, [resumeList, resumes, selectedResumeId]);

  useEffect(() => {
    if (!selectedResume) return;

    const nextRole =
      selectedResume.targetRole ||
      selectedResume.basic?.title ||
      getTargetRoleValue(TARGET_ROLE_PRESETS[0], locale);
    setTargetRole(nextRole);
    setRolePreset(findRolePresetId(nextRole, locale));
    setJobDescription(selectedResume.jobDescription || "");
    setAnalysis(selectedResume.analysisHistory?.[0] || null);
  }, [locale, selectedResume?.id]);

  const handleRolePresetChange = (value: string) => {
    setRolePreset(value);
    const nextRole = resolveRolePresetValue(value, locale);
    if (nextRole) {
      setTargetRole(nextRole);
    }
  };

  const runAnalysis = async () => {
    if (!selectedResume) {
      toast.error(t("dashboard.analyze.toast.selectResume"));
      return;
    }

    const role = targetRole.trim();
    const jd = jobDescription.trim();
    if (!role && !jd) {
      toast.error(t("dashboard.analyze.toast.needContext"));
      return;
    }

    setIsAnalyzing(true);
    setIsAiEnhancing(false);
    const localAnalysis = analyzeResumeLocally({
      resume: selectedResume,
      targetRole: role,
      jobDescription: jd,
      locale,
    });
    setAnalysis(localAnalysis);
    updateResumeAnalysis(selectedResume.id, localAnalysis);
    setIsAnalyzing(false);

    if (!aiConfigured) {
      toast.info(t("dashboard.analyze.toast.localOnly"));
      return;
    }

    try {
      setIsAiEnhancing(true);
      const { config, selectedModel, apiKey, modelId, apiEndpoint } =
        getConfiguredAIRequest();
      if (!config) {
        throw new Error(t("dashboard.analyze.toast.aiFailed"));
      }
      const response = await fetch("/api/resume-analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resume: selectedResume,
          jobDescription: jd,
          targetRole: role,
          locale,
          baseAnalysis: localAnalysis,
          apiKey,
          apiEndpoint,
          model: config.requiresModelId ? modelId : config.defaultModel,
          modelType: selectedModel,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || t("dashboard.analyze.toast.aiFailed"));
      }

      const nextAnalysis = data.analysis as ResumeAnalysis;
      setAnalysis(nextAnalysis);
      updateResumeAnalysis(selectedResume.id, nextAnalysis);

      if (nextAnalysis.aiError) {
        toast.warning(nextAnalysis.aiError);
      } else {
        toast.success(t("dashboard.analyze.toast.aiEnhanced"));
      }
    } catch (error) {
      toast.warning(
        error instanceof Error ? error.message : t("dashboard.analyze.toast.aiFailed")
      );
    } finally {
      setIsAiEnhancing(false);
    }
  };

  const createVersion = () => {
    if (!selectedResume) return;
    const role = targetRole.trim() || selectedResume.targetRole || "";
    const defaultName = role
      ? t("dashboard.analyze.version.defaultName", { role })
      : t("dashboard.analyze.version.fallbackName");
    const newId = createResumeVersion(selectedResume.id, {
      versionName: defaultName,
      targetRole: role,
      jobDescription: jobDescription.trim(),
    });

    if (!newId) {
      toast.error(t("dashboard.analyze.toast.versionFailed"));
      return;
    }

    setActiveResume(newId);
    toast.success(t("dashboard.analyze.toast.versionCreated"));
    router.push(`/app/workbench/${newId}`);
  };

  const matchedKeywords = analysis?.keywords.filter((item) => item.matched) || [];
  const missingKeywords = analysis?.missingKeywords || [];
  const canCreateVersion = Boolean(selectedResume && (targetRole.trim() || jobDescription.trim()));

  return (
    <ScrollArea className="h-[calc(100vh-2rem)] w-full">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              {t("dashboard.analyze.kicker")}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {t("dashboard.analyze.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {t("dashboard.analyze.description")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={createVersion}
            disabled={!canCreateVersion}
            className="gap-2"
          >
            <CopyPlus className="h-4 w-4" />
            {t("dashboard.analyze.version.create")}
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[380px,1fr]">
          <Card className="rounded-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">
                {t("dashboard.analyze.form.title")}
              </CardTitle>
              <CardDescription>
                {t("dashboard.analyze.form.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("dashboard.analyze.form.resume")}</Label>
                <Select
                  value={selectedResumeId}
                  onValueChange={(value) => setSelectedResumeId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("dashboard.analyze.form.resumePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {resumeList.map((resume) => (
                      <SelectItem key={resume.id} value={resume.id}>
                        {resume.title || t("dashboard.resumes.untitled")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("dashboard.analyze.form.rolePreset")}</Label>
                <Select value={rolePreset} onValueChange={handleRolePresetChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_ROLE_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {getTargetRoleLabel(preset, locale)}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">
                      {t("dashboard.analyze.form.customRole")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="analyze-target-role">
                  {t("dashboard.analyze.form.targetRole")}
                </Label>
                <Input
                  id="analyze-target-role"
                  value={targetRole}
                  onChange={(event) => {
                    setTargetRole(event.target.value);
                    setRolePreset("custom");
                  }}
                  placeholder={t("dashboard.analyze.form.targetRolePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="analyze-jd">
                  {t("dashboard.analyze.form.jobDescription")}
                </Label>
                <Textarea
                  id="analyze-jd"
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  placeholder={t("dashboard.analyze.form.jdPlaceholder")}
                  rows={10}
                  className="resize-none"
                />
              </div>

              <Button
                type="button"
                className="w-full gap-2"
                onClick={runAnalysis}
                disabled={isAnalyzing || isAiEnhancing || !selectedResume}
              >
                {(isAnalyzing || isAiEnhancing) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {isAiEnhancing
                  ? t("dashboard.analyze.actions.aiEnhancing")
                  : t("dashboard.analyze.actions.run")}
              </Button>
              {!aiConfigured && (
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("dashboard.analyze.form.localHint")}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {analysis ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {getScoreItems(analysis, t).map((item) => (
                    <Card key={item.key} className="rounded-lg">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-muted-foreground">
                            {item.label}
                          </span>
                          <span
                            className={cn(
                              "rounded-md border px-2 py-1 text-sm font-semibold",
                              scoreTone(item.value)
                            )}
                          >
                            {item.value}
                          </span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${item.value}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="rounded-lg">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        {t("dashboard.analyze.result.summary")}
                      </CardTitle>
                      <Badge variant={analysis.aiEnhanced ? "default" : "secondary"}>
                        {analysis.aiEnhanced
                          ? t("dashboard.analyze.result.aiEnhanced")
                          : t("dashboard.analyze.result.localRule")}
                      </Badge>
                    </div>
                    <CardDescription>{analysis.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {t("dashboard.analyze.result.matchedKeywords")}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {matchedKeywords.length ? (
                          matchedKeywords.map((item) => (
                            <Badge key={item.keyword} variant="outline">
                              {item.keyword}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {t("dashboard.analyze.result.empty")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        {t("dashboard.analyze.result.missingKeywords")}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {missingKeywords.length ? (
                          missingKeywords.map((keyword) => (
                            <Badge key={keyword} variant="secondary">
                              {keyword}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {t("dashboard.analyze.result.empty")}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-3">
                  <AnalysisList
                    title={t("dashboard.analyze.result.strengths")}
                    icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    items={analysis.strengths}
                  />
                  <AnalysisList
                    title={t("dashboard.analyze.result.risks")}
                    icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
                    items={analysis.risks}
                  />
                  <AnalysisList
                    title={t("dashboard.analyze.result.suggestions")}
                    icon={<Sparkles className="h-4 w-4 text-primary" />}
                    items={analysis.suggestions}
                  />
                </div>

                <Card className="rounded-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {t("dashboard.analyze.result.rewrites")}
                    </CardTitle>
                    <CardDescription>
                      {t("dashboard.analyze.result.rewritesDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analysis.rewrites.length ? (
                      analysis.rewrites.map((rewrite, index) => (
                        <div
                          key={`${rewrite.title}-${index}`}
                          className="rounded-lg border bg-muted/20 p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">
                              {t(`dashboard.analyze.sections.${rewrite.section}`)}
                            </Badge>
                            <span className="text-sm font-medium">
                              {rewrite.title}
                            </span>
                          </div>
                          {rewrite.before && (
                            <p className="mt-3 text-xs leading-5 text-muted-foreground">
                              {rewrite.before}
                            </p>
                          )}
                          <p className="mt-3 text-sm leading-6">{rewrite.after}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("dashboard.analyze.result.empty")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="rounded-lg">
                <CardContent className="flex min-h-[520px] flex-col items-center justify-center p-6 text-center">
                  <BriefcaseBusiness className="h-10 w-10 text-muted-foreground" />
                  <h2 className="mt-4 text-lg font-semibold">
                    {t("dashboard.analyze.empty.title")}
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    {t("dashboard.analyze.empty.description")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

const AnalysisList = ({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
}) => (
  <Card className="rounded-lg">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base">
        {icon}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="text-sm leading-6">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">-</p>
      )}
    </CardContent>
  </Card>
);

export default AnalyzePage;

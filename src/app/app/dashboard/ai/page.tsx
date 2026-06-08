import { useEffect, useState } from "react";
import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/i18n/compat/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import DeepSeekLogo from "@/components/ai/icon/IconDeepseek";
import IconDoubao from "@/components/ai/icon/IconDoubao";
import IconOpenAi from "@/components/ai/icon/IconOpenAi";
import { useAIConfigStore } from "@/store/useAIConfigStore";
import { AIModelType, CustomAIModel } from "@/config/ai";
import { cn } from "@/lib/utils";

const providerOrder: AIModelType[] = [
  "deepseek",
  "doubao",
  "openai",
  "gemini",
  "custom",
];

const providerIcons: Record<AIModelType, React.ComponentType<{ className?: string }>> = {
  deepseek: DeepSeekLogo,
  doubao: IconDoubao,
  openai: IconOpenAi,
  gemini: Sparkles,
  custom: Wifi,
};

const providerLinks: Record<AIModelType, string> = {
  deepseek: "https://platform.deepseek.com",
  doubao: "https://console.volcengine.com/ark",
  openai: "https://platform.openai.com/api-keys",
  gemini: "https://aistudio.google.com/app/apikey",
  custom: "",
};

const providerColors: Record<AIModelType, string> = {
  deepseek: "text-purple-500",
  doubao: "text-blue-500",
  openai: "text-blue-500",
  gemini: "text-amber-500",
  custom: "text-emerald-500",
};

const providerNeedsEndpoint = (provider: AIModelType) =>
  provider === "openai" ||
  provider === "custom" ||
  provider === "deepseek" ||
  provider === "doubao";

const getProviderName = (provider: AIModelType, t: ReturnType<typeof useTranslations>) => {
  if (provider === "custom") return "自定义供应商";
  return t(`dashboard.settings.ai.${provider}.title`);
};

const getProviderDescription = (
  provider: AIModelType,
  t: ReturnType<typeof useTranslations>
) => {
  if (provider === "custom") {
    return "添加 OpenAI 兼容接口，自定义模型并测试连接";
  }
  return t(`dashboard.settings.ai.${provider}.description`);
};

const getDefaultModelName = (provider: AIModelType) => {
  if (provider === "custom") return "自定义模型";
  return "默认模型";
};

const AISettingsPage = () => {
  const {
    selectedModel,
    setSelectedModel,
    addProviderModel,
    updateProviderModel,
    deleteProviderModel,
    setSelectedProviderModelId,
    getProviderModels,
    getSelectedProviderModel,
    ensureProviderModel,
  } = useAIConfigStore();
  const [currentProvider, setCurrentProvider] = useState<AIModelType>(selectedModel);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const t = useTranslations();

  useEffect(() => {
    setCurrentProvider(selectedModel);
    ensureProviderModel(selectedModel);
  }, [selectedModel]);

  const testModel = async (provider: AIModelType, model: CustomAIModel) => {
    setTestingModelId(model.id);
    try {
      const response = await fetch("/api/ai-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          apiKey: model.apiKey,
          model: model.modelId,
          apiEndpoint: model.apiEndpoint,
        }),
      });
      const data = await response.json();
      if (data?.ok) {
        updateProviderModel(provider, model.id, {
          lastTestLatencyMs: data.latencyMs,
          lastTestedAt: new Date().toISOString(),
        });
        toast.success(`连接成功，响应速度 ${data.latencyMs}ms`);
      } else {
        toast.error(data?.error || "连接测试失败");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "连接测试失败");
    } finally {
      setTestingModelId(null);
    }
  };

  const providers = providerOrder.map((provider) => {
    const models = getProviderModels(provider);
    return {
      id: provider,
      name: getProviderName(provider, t),
      description: getProviderDescription(provider, t),
      icon: providerIcons[provider],
      link: providerLinks[provider],
      color: providerColors[provider],
      isConfigured: models.some((model) => {
        const hasEndpoint = !providerNeedsEndpoint(provider) || !!model.apiEndpoint;
        return !!(model.apiKey && model.modelId && hasEndpoint);
      }),
      models,
    };
  });

  return (
    <div className="mx-auto py-4 px-4">
      <div className="flex gap-8">
        <div className="w-64 space-y-6">
          <div className="flex flex-col space-y-1">
            {providers.map((provider) => {
              const Icon = provider.icon;
              const isChecked = selectedModel === provider.id;
              const isViewing = currentProvider === provider.id;

              return (
                <div
                  key={provider.id}
                  onClick={() => {
                    setCurrentProvider(provider.id);
                    ensureProviderModel(provider.id);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left border",
                    "transition-all duration-200 cursor-pointer",
                    "hover:bg-primary/10 hover:border-primary/30",
                    isViewing
                      ? "bg-primary/10 border-primary/40"
                      : "border-transparent"
                  )}
                >
                  <div
                    className={cn(
                      "shrink-0",
                      isViewing ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col items-start">
                    <span
                      className={cn(
                        "font-medium text-sm",
                        isViewing && "text-primary"
                      )}
                    >
                      {provider.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {provider.isConfigured
                        ? t("common.configured")
                        : t("common.notConfigured")}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Select ${provider.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      ensureProviderModel(provider.id);
                      setSelectedModel(provider.id);
                      setCurrentProvider(provider.id);
                    }}
                    className={cn(
                      "h-6 w-6 rounded-md flex items-center justify-center border transition-all",
                      "shrink-0",
                      isChecked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-transparent border-muted-foreground/40 text-transparent hover:border-primary/40"
                    )}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 max-w-2xl">
          {providers.map((provider) => {
            if (provider.id !== currentProvider) return null;

            const Icon = provider.icon;
            const selectedProviderModel = getSelectedProviderModel(provider.id);

            return (
              <div key={provider.id} className="space-y-8">
                <div>
                  <h2 className="text-2xl font-semibold flex items-center gap-2">
                    <div className={cn("shrink-0", provider.color)}>
                      <Icon className="h-6 w-6" />
                    </div>
                    {provider.name}
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    {provider.description}
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">
                        模型配置
                      </Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        当前服务商可维护多个模型，勾选左侧选择按钮后全局使用当前选中模型。
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {provider.link && (
                        <a
                          href={provider.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                        >
                          {t("dashboard.settings.ai.getApiKey")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const id = addProviderModel(provider.id, {
                            name: getDefaultModelName(provider.id),
                          });
                          setSelectedProviderModelId(provider.id, id);
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        添加模型
                      </Button>
                    </div>
                  </div>

                  {provider.models.length === 0 && (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                      暂无模型，请点击“添加模型”开始配置。
                    </div>
                  )}

                  {provider.models.map((model, index) => {
                    const isCurrent = selectedProviderModel?.id === model.id;
                    const canDelete = provider.models.length > 1;

                    return (
                      <div
                        key={model.id}
                        className={cn(
                          "space-y-4 rounded-lg border p-4",
                          isCurrent
                            ? "border-primary/50 bg-primary/5"
                            : "border-gray-200 dark:border-gray-800"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            className="text-left text-sm font-medium"
                            onClick={() =>
                              setSelectedProviderModelId(provider.id, model.id)
                            }
                          >
                            {model.name || `${provider.name}模型 ${index + 1}`}
                            {isCurrent && (
                              <span className="ml-2 text-xs text-primary">
                                当前使用
                              </span>
                            )}
                          </button>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => testModel(provider.id, model)}
                              disabled={testingModelId === model.id}
                            >
                              {testingModelId === model.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Wifi className="mr-2 h-4 w-4" />
                              )}
                              测试连接
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={!canDelete}
                              onClick={() => deleteProviderModel(provider.id, model.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>显示名称</Label>
                            <Input
                              value={model.name}
                              onChange={(event) =>
                                updateProviderModel(provider.id, model.id, {
                                  name: event.target.value,
                                })
                              }
                              placeholder="如：默认模型"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>模型 ID</Label>
                            <Input
                              value={model.modelId}
                              onChange={(event) =>
                                updateProviderModel(provider.id, model.id, {
                                  modelId: event.target.value,
                                })
                              }
                              placeholder="如：gpt-4o-mini"
                            />
                          </div>
                        </div>

                        {providerNeedsEndpoint(provider.id) && (
                          <div className="space-y-2">
                            <Label>API Endpoint</Label>
                            <Input
                              value={model.apiEndpoint}
                              onChange={(event) =>
                                updateProviderModel(provider.id, model.id, {
                                  apiEndpoint: event.target.value,
                                })
                              }
                              placeholder="如：https://api.openai.com/v1"
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>API Key</Label>
                          <div className="flex gap-2">
                            <Input
                              value={model.apiKey}
                              type={model.showApiKey ? "text" : "password"}
                              onChange={(event) =>
                                updateProviderModel(provider.id, model.id, {
                                  apiKey: event.target.value,
                                })
                              }
                              placeholder="sk-..."
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                updateProviderModel(provider.id, model.id, {
                                  showApiKey: !model.showApiKey,
                                })
                              }
                            >
                              {model.showApiKey ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={model.supportsVision}
                              onChange={(event) =>
                                updateProviderModel(provider.id, model.id, {
                                  supportsVision: event.target.checked,
                                })
                              }
                              className="h-4 w-4"
                            />
                            多模态模型，支持 OpenAI Vision 兼容格式的 PDF 简历导入
                          </label>
                          {model.lastTestLatencyMs !== undefined && (
                            <span className="text-muted-foreground">
                              最近响应速度：{model.lastTestLatencyMs}ms
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const runtime = "edge";

export default AISettingsPage;

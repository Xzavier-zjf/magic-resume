export type AIModelType = "doubao" | "deepseek" | "openai" | "gemini" | "custom";

export interface CustomAIModel {
  id: string;
  name: string;
  modelId: string;
  apiEndpoint: string;
  apiKey: string;
  supportsVision: boolean;
  showApiKey: boolean;
  lastTestLatencyMs?: number;
  lastTestedAt?: string;
}

export interface AIValidationContext {
  doubaoApiKey?: string;
  doubaoModelId?: string;
  deepseekApiKey?: string;
  deepseekModelId?: string;
  openaiApiKey?: string;
  openaiModelId?: string;
  openaiApiEndpoint?: string;
  geminiApiKey?: string;
  geminiModelId?: string;
  customModels?: CustomAIModel[];
  selectedCustomModelId?: string;
  providerModels?: Partial<Record<AIModelType, CustomAIModel[]>>;
  selectedProviderModelIds?: Partial<Record<AIModelType, string>>;
}

export interface AIModelConfig {
  url: (endpoint?: string) => string;
  requiresModelId: boolean;
  defaultModel?: string;
  headers: (apiKey: string) => Record<string, string>;
  validate: (context: AIValidationContext) => boolean;
}

export const AI_MODEL_CONFIGS: Record<AIModelType, AIModelConfig> = {
  doubao: {
    url: (endpoint?: string) =>
      `${(endpoint || "https://ark.cn-beijing.volces.com/api/v3").trim().replace(/\/+$/, "")}/chat/completions`,
    requiresModelId: true,
    headers: (apiKey: string) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    validate: (context: AIValidationContext) => {
      const model = context.providerModels?.doubao?.find(
        (item) => item.id === context.selectedProviderModelIds?.doubao
      ) || context.providerModels?.doubao?.[0];
      return !!(model?.apiKey && model?.modelId) || !!(context.doubaoApiKey && context.doubaoModelId);
    },
  },
  deepseek: {
    url: (endpoint?: string) =>
      `${(endpoint || "https://api.deepseek.com/v1").trim().replace(/\/+$/, "")}/chat/completions`,
    requiresModelId: true,
    defaultModel: "deepseek-chat",
    headers: (apiKey: string) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    validate: (context: AIValidationContext) => {
      const model = context.providerModels?.deepseek?.find(
        (item) => item.id === context.selectedProviderModelIds?.deepseek
      ) || context.providerModels?.deepseek?.[0];
      return !!(model?.apiKey && model?.modelId) || !!context.deepseekApiKey;
    },
  },
  openai: {
    url: (endpoint?: string) => `${(endpoint || "").trim().replace(/\/+$/, "")}/chat/completions`,
    requiresModelId: true,
    headers: (apiKey: string) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    validate: (context: AIValidationContext) => {
      const model = context.providerModels?.openai?.find(
        (item) => item.id === context.selectedProviderModelIds?.openai
      ) || context.providerModels?.openai?.[0];
      return !!(model?.apiKey && model?.modelId && model?.apiEndpoint) || !!(context.openaiApiKey && context.openaiModelId && context.openaiApiEndpoint);
    },
  },
  custom: {
    url: (endpoint?: string) => `${(endpoint || "").trim().replace(/\/+$/, "")}/chat/completions`,
    requiresModelId: true,
    headers: (apiKey: string) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    validate: (context: AIValidationContext) => {
      const model = context.providerModels?.custom?.find(
        (item) => item.id === context.selectedProviderModelIds?.custom
      ) || context.providerModels?.custom?.[0] || context.customModels?.find((item) => item.id === context.selectedCustomModelId);
      return !!(model?.apiKey && model?.modelId && model?.apiEndpoint);
    },
  },
  gemini: {
    url: () => "https://generativelanguage.googleapis.com/v1beta",
    requiresModelId: true,
    headers: (apiKey: string) => ({
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    }),
    validate: (context: AIValidationContext) => {
      const model = context.providerModels?.gemini?.find(
        (item) => item.id === context.selectedProviderModelIds?.gemini
      ) || context.providerModels?.gemini?.[0];
      return !!(model?.apiKey && model?.modelId) || !!(context.geminiApiKey && context.geminiModelId);
    },
  },
};

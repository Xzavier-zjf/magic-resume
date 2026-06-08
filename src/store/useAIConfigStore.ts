import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AI_MODEL_CONFIGS, AIModelType, CustomAIModel } from "@/config/ai";

interface AIConfigState {
  selectedModel: AIModelType;
  doubaoApiKey: string;
  doubaoModelId: string;
  deepseekApiKey: string;
  deepseekModelId: string;
  openaiApiKey: string;
  openaiModelId: string;
  openaiApiEndpoint: string;
  geminiApiKey: string;
  geminiModelId: string;
  customModels: CustomAIModel[];
  selectedCustomModelId: string;
  providerModels: Partial<Record<AIModelType, CustomAIModel[]>>;
  selectedProviderModelIds: Partial<Record<AIModelType, string>>;
  setSelectedModel: (model: AIModelType) => void;
  setDoubaoApiKey: (apiKey: string) => void;
  setDoubaoModelId: (modelId: string) => void;
  setDeepseekApiKey: (apiKey: string) => void;
  setDeepseekModelId: (modelId: string) => void;
  setOpenaiApiKey: (apiKey: string) => void;
  setOpenaiModelId: (modelId: string) => void;
  setOpenaiApiEndpoint: (endpoint: string) => void;
  setGeminiApiKey: (apiKey: string) => void;
  setGeminiModelId: (modelId: string) => void;
  addCustomModel: (model?: Partial<CustomAIModel>) => string;
  updateCustomModel: (id: string, model: Partial<CustomAIModel>) => void;
  deleteCustomModel: (id: string) => void;
  setSelectedCustomModelId: (id: string) => void;
  getSelectedCustomModel: () => CustomAIModel | undefined;
  addProviderModel: (provider: AIModelType, model?: Partial<CustomAIModel>) => string;
  updateProviderModel: (provider: AIModelType, id: string, model: Partial<CustomAIModel>) => void;
  deleteProviderModel: (provider: AIModelType, id: string) => void;
  setSelectedProviderModelId: (provider: AIModelType, id: string) => void;
  getProviderModels: (provider: AIModelType) => CustomAIModel[];
  getSelectedProviderModel: (provider?: AIModelType) => CustomAIModel | undefined;
  ensureProviderModel: (provider: AIModelType) => string;
  isConfigured: () => boolean;
}

const createModelId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createProviderModel = (
  provider: AIModelType,
  model?: Partial<CustomAIModel>
): CustomAIModel => ({
  id: model?.id || createModelId(),
  name: model?.name || "默认模型",
  modelId:
    model?.modelId ||
    (provider === "deepseek"
      ? "deepseek-chat"
      : provider === "gemini"
        ? "gemini-flash-latest"
        : ""),
  apiEndpoint:
    model?.apiEndpoint ||
    (provider === "openai"
      ? ""
      : provider === "deepseek"
        ? "https://api.deepseek.com/v1"
        : provider === "doubao"
          ? "https://ark.cn-beijing.volces.com/api/v3"
          : ""),
  apiKey: model?.apiKey || "",
  supportsVision: model?.supportsVision ?? provider === "gemini",
  showApiKey: model?.showApiKey ?? false,
  lastTestLatencyMs: model?.lastTestLatencyMs,
  lastTestedAt: model?.lastTestedAt,
});

export const useAIConfigStore = create<AIConfigState>()(
  persist(
    (set, get) => ({
      selectedModel: "doubao",
      doubaoApiKey: "",
      doubaoModelId: "",
      deepseekApiKey: "",
      deepseekModelId: "",
      openaiApiKey: "",
      openaiModelId: "",
      openaiApiEndpoint: "",
      geminiApiKey: "",
      geminiModelId: "gemini-flash-latest",
      customModels: [],
      selectedCustomModelId: "",
      providerModels: {},
      selectedProviderModelIds: {},
      setSelectedModel: (model: AIModelType) => set({ selectedModel: model }),
      setDoubaoApiKey: (apiKey: string) => set({ doubaoApiKey: apiKey }),
      setDoubaoModelId: (modelId: string) => set({ doubaoModelId: modelId }),
      setDeepseekApiKey: (apiKey: string) => set({ deepseekApiKey: apiKey }),
      setDeepseekModelId: (modelId: string) => set({ deepseekModelId: modelId }),
      setOpenaiApiKey: (apiKey: string) => set({ openaiApiKey: apiKey }),
      setOpenaiModelId: (modelId: string) => set({ openaiModelId: modelId }),
      setOpenaiApiEndpoint: (endpoint: string) => set({ openaiApiEndpoint: endpoint }),
      setGeminiApiKey: (apiKey: string) => set({ geminiApiKey: apiKey }),
      setGeminiModelId: (modelId: string) => set({ geminiModelId: modelId }),
      addCustomModel: (model) => {
        const nextModel = createProviderModel("custom", {
          name: "自定义模型",
          ...model,
        });
        const id = nextModel.id;

        set((state) => ({
          customModels: [...state.customModels, nextModel],
          selectedCustomModelId: state.selectedCustomModelId || id,
          providerModels: {
            ...state.providerModels,
            custom: [...(state.providerModels.custom || []), nextModel],
          },
          selectedProviderModelIds: {
            ...state.selectedProviderModelIds,
            custom: state.selectedProviderModelIds.custom || id,
          },
        }));
        return id;
      },
      updateCustomModel: (id, model) =>
        set((state) => ({
          customModels: state.customModels.map((item) =>
            item.id === id ? { ...item, ...model } : item
          ),
          providerModels: {
            ...state.providerModels,
            custom: (state.providerModels.custom || []).map((item) =>
              item.id === id ? { ...item, ...model } : item
            ),
          },
        })),
      deleteCustomModel: (id) =>
        set((state) => {
          const customModels = state.customModels.filter((item) => item.id !== id);
          const customProviderModels = (state.providerModels.custom || []).filter(
            (item) => item.id !== id
          );
          const selectedCustomModelId =
            state.selectedCustomModelId === id
              ? customModels[0]?.id || ""
              : state.selectedCustomModelId;

          return {
            customModels,
            selectedCustomModelId,
            providerModels: {
              ...state.providerModels,
              custom: customProviderModels,
            },
            selectedProviderModelIds: {
              ...state.selectedProviderModelIds,
              custom:
                state.selectedProviderModelIds.custom === id
                  ? customProviderModels[0]?.id || ""
                  : state.selectedProviderModelIds.custom,
            },
            selectedModel:
              state.selectedModel === "custom" && !selectedCustomModelId
                ? "doubao"
                : state.selectedModel,
          };
        }),
      setSelectedCustomModelId: (id) => set({ selectedCustomModelId: id }),
      getSelectedCustomModel: () => {
        const state = get();
        return state.getSelectedProviderModel("custom") || state.customModels.find((item) => item.id === state.selectedCustomModelId);
      },
      addProviderModel: (provider, model) => {
        const nextModel = createProviderModel(provider, model);
        set((state) => ({
          providerModels: {
            ...state.providerModels,
            [provider]: [...(state.providerModels[provider] || []), nextModel],
          },
          selectedProviderModelIds: {
            ...state.selectedProviderModelIds,
            [provider]: state.selectedProviderModelIds[provider] || nextModel.id,
          },
          ...(provider === "custom"
            ? {
                customModels: [...state.customModels, nextModel],
                selectedCustomModelId: state.selectedCustomModelId || nextModel.id,
              }
            : {}),
        }));
        return nextModel.id;
      },
      updateProviderModel: (provider, id, model) =>
        set((state) => ({
          providerModels: {
            ...state.providerModels,
            [provider]: (() => {
              const models = state.providerModels[provider] || [];
              if (models.some((item) => item.id === id)) {
                return models.map((item) =>
                  item.id === id ? { ...item, ...model } : item
                );
              }

              const legacyModel = state.getProviderModels(provider).find(
                (item) => item.id === id
              );
              return legacyModel
                ? [{ ...legacyModel, ...model }]
                : models;
            })(),
          },
          ...(provider === "custom"
            ? {
                customModels: state.customModels.map((item) =>
                  item.id === id ? { ...item, ...model } : item
                ),
              }
            : {}),
        })),
      deleteProviderModel: (provider, id) =>
        set((state) => {
          const sourceModels = state.providerModels[provider]?.length
            ? state.providerModels[provider] || []
            : state.getProviderModels(provider);
          const models = sourceModels.filter(
            (item) => item.id !== id
          );
          const selectedId =
            state.selectedProviderModelIds[provider] === id
              ? models[0]?.id || ""
              : state.selectedProviderModelIds[provider];

          return {
            providerModels: {
              ...state.providerModels,
              [provider]: models,
            },
            selectedProviderModelIds: {
              ...state.selectedProviderModelIds,
              [provider]: selectedId,
            },
            ...(provider === "custom"
              ? {
                  customModels: state.customModels.filter((item) => item.id !== id),
                  selectedCustomModelId:
                    state.selectedCustomModelId === id
                      ? models[0]?.id || ""
                      : state.selectedCustomModelId,
                }
              : {}),
          };
        }),
      setSelectedProviderModelId: (provider, id) =>
        set((state) => ({
          providerModels: {
            ...state.providerModels,
            [provider]: state.providerModels[provider]?.length
              ? state.providerModels[provider]
              : state.getProviderModels(provider),
          },
          selectedProviderModelIds: {
            ...state.selectedProviderModelIds,
            [provider]: id,
          },
          ...(provider === "custom" ? { selectedCustomModelId: id } : {}),
        })),
      getProviderModels: (provider) => {
        const state = get();
        const models = state.providerModels[provider] || [];
        if (models.length > 0) return models;

        if (provider === "doubao" && (state.doubaoApiKey || state.doubaoModelId)) {
          return [
            createProviderModel("doubao", {
              id: "legacy-doubao",
              name: "默认模型",
              apiKey: state.doubaoApiKey,
              modelId: state.doubaoModelId,
            }),
          ];
        }
        if (provider === "deepseek" && state.deepseekApiKey) {
          return [
            createProviderModel("deepseek", {
              id: "legacy-deepseek",
              name: "默认模型",
              apiKey: state.deepseekApiKey,
              modelId: state.deepseekModelId || "deepseek-chat",
            }),
          ];
        }
        if (provider === "openai" && (state.openaiApiKey || state.openaiModelId || state.openaiApiEndpoint)) {
          return [
            createProviderModel("openai", {
              id: "legacy-openai",
              name: "默认模型",
              apiKey: state.openaiApiKey,
              modelId: state.openaiModelId,
              apiEndpoint: state.openaiApiEndpoint,
            }),
          ];
        }
        if (provider === "gemini" && (state.geminiApiKey || state.geminiModelId)) {
          return [
            createProviderModel("gemini", {
              id: "legacy-gemini",
              name: "默认模型",
              apiKey: state.geminiApiKey,
              modelId: state.geminiModelId,
              supportsVision: true,
            }),
          ];
        }
        if (provider === "custom") {
          return state.customModels;
        }
        return [];
      },
      getSelectedProviderModel: (provider) => {
        const state = get();
        const targetProvider = provider || state.selectedModel;
        const models = state.getProviderModels(targetProvider);
        const selectedId =
          state.selectedProviderModelIds[targetProvider] ||
          (targetProvider === "custom" ? state.selectedCustomModelId : "");
        return models.find((item) => item.id === selectedId) || models[0];
      },
      ensureProviderModel: (provider) => {
        const state = get();
        const existing = state.getProviderModels(provider)[0];
        if (existing && !existing.id.startsWith("legacy-")) {
          return existing.id;
        }
        const normalizedExisting = existing?.id.startsWith("legacy-")
          ? { ...existing, id: undefined }
          : existing;
        const id = state.addProviderModel(provider, normalizedExisting);
        state.setSelectedProviderModelId(provider, id);
        return id;
      },
      isConfigured: () => {
        const state = get();
        const config = AI_MODEL_CONFIGS[state.selectedModel];
        return config.validate(state);
      }
    }),
    {
      name: "ai-config-storage"
    }
  )
);

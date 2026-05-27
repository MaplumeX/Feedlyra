import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "@/lib/i18n-zod";
import { Loader2, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAIConfig, useUpdateAIConfig, type UpdateAIConfigPayload } from "@/api/hooks";
import { useReaderStore } from "@/stores/reader";
import { cn } from "@/lib/utils";

const aiConfigSchema = z.object({
  base_url: z.string().url().or(z.literal("")),
  api_key: z.string().or(z.literal("")),
  model: z.string().min(1),
});

type AIConfigForm = z.infer<typeof aiConfigSchema>;

type FeatureName = "translate" | "summary" | "chat";

interface FeatureFormState {
  enabled: boolean;
  base_url: string;
  api_key: string;
  model: string;
}

function featureDefaults(config: AIConfigForm, featureConfig: { enabled: boolean; base_url: string | null; model: string | null; has_api_key: boolean }): FeatureFormState {
  return {
    enabled: featureConfig.enabled,
    base_url: featureConfig.base_url ?? "",
    api_key: featureConfig.has_api_key ? "********" : "",
    model: featureConfig.model ?? config.model,
  };
}

const FEATURE_LABELS: Record<FeatureName, string> = {
  translate: "translateConfig",
  summary: "summaryConfig",
  chat: "chatConfig",
};

export function AISettingsTab() {
  const { t } = useTranslation("settings");
  const { data: config, isLoading } = useAIConfig();
  const updateConfig = useUpdateAIConfig();
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState("");

  const { autoSummarize, set: setReader } = useReaderStore();

  const { register, handleSubmit, formState: { errors } } = useForm<AIConfigForm>({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: {
      base_url: config?.base_url ?? "https://api.openai.com/v1",
      api_key: config?.has_api_key ? "********" : "",
      model: config?.model ?? "gpt-4o-mini",
    },
    values: config ? {
      base_url: config.base_url ?? "https://api.openai.com/v1",
      api_key: config.has_api_key ? "********" : "",
      model: config.model ?? "gpt-4o-mini",
    } : undefined,
  });

  const [translate, setTranslate] = useState<FeatureFormState>(() =>
    featureDefaults(
      { base_url: config?.base_url ?? "https://api.openai.com/v1", api_key: "", model: config?.model ?? "gpt-4o-mini" },
      config?.translate ?? { enabled: false, base_url: null, model: null, has_api_key: false },
    ),
  );
  const [summary, setSummary] = useState<FeatureFormState>(() =>
    featureDefaults(
      { base_url: config?.base_url ?? "https://api.openai.com/v1", api_key: "", model: config?.model ?? "gpt-4o-mini" },
      config?.summary ?? { enabled: false, base_url: null, model: null, has_api_key: false },
    ),
  );
  const [chat, setChat] = useState<FeatureFormState>(() =>
    featureDefaults(
      { base_url: config?.base_url ?? "https://api.openai.com/v1", api_key: "", model: config?.model ?? "gpt-4o-mini" },
      config?.chat ?? { enabled: false, base_url: null, model: null, has_api_key: false },
    ),
  );

  const featureInitialized = useRef(false);

  useEffect(() => {
    if (config && !featureInitialized.current) {
      const global: AIConfigForm = {
        base_url: config.base_url ?? "https://api.openai.com/v1",
        api_key: "",
        model: config.model ?? "gpt-4o-mini",
      };
      setTranslate(featureDefaults(global, config.translate));
      setSummary(featureDefaults(global, config.summary));
      setChat(featureDefaults(global, config.chat));
      featureInitialized.current = true;
    }
  }, [config]);

  const [expanded, setExpanded] = useState<Record<FeatureName, boolean>>({
    translate: false,
    summary: false,
    chat: false,
  });

  const featureState: Record<FeatureName, FeatureFormState> = { translate, summary, chat };
  const featureSetters: Record<FeatureName, (s: FeatureFormState) => void> = {
    translate: setTranslate,
    summary: setSummary,
    chat: setChat,
  };

  function buildFeaturePayload(fs: FeatureFormState, originalEnabled: boolean) {
    if (!fs.enabled && !originalEnabled) return undefined;
    if (!fs.enabled) return { enabled: false };
    const payload: Record<string, string | null | boolean> = { enabled: true };
    if (fs.base_url) payload.base_url = fs.base_url;
    else payload.base_url = null;
    if (fs.api_key && fs.api_key !== "********") payload.api_key = fs.api_key;
    if (fs.model) payload.model = fs.model;
    return payload;
  }

  const onSubmit = (data: AIConfigForm) => {
    const payload: UpdateAIConfigPayload = {};
    if (data.base_url) payload.base_url = data.base_url;
    if (data.api_key && data.api_key !== "********") payload.api_key = data.api_key;
    if (data.model) payload.model = data.model;

    payload.translate = buildFeaturePayload(translate, config?.translate?.enabled ?? false);
    payload.summary = buildFeaturePayload(summary, config?.summary?.enabled ?? false);
    payload.chat = buildFeaturePayload(chat, config?.chat?.enabled ?? false);

    updateConfig.mutate(payload);
  };

  const handleTest = async () => {
    setTestStatus("testing");
    setTestError("");
    try {
      const token = localStorage.getItem("access_token");
      const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${API_BASE}/api/ai/test-connection`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: t("connectionFailed") }));
        setTestStatus("error");
        setTestError(data.detail ?? t("connectionFailed"));
        return;
      }
      setTestStatus("success");
    } catch {
      setTestStatus("error");
      setTestError(t("connectionFailed"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Global Config */}
      <div>
        <h3 className="text-sm font-semibold mb-3">{t("byokConfiguration")}</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="base_url">{t("baseUrl")}</Label>
            <Input id="base_url" placeholder="https://api.openai.com/v1" {...register("base_url")} />
            {errors.base_url && <p className="text-xs text-destructive">{errors.base_url.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="api_key">{t("apiKey")}</Label>
            <Input id="api_key" type="password" placeholder="sk-..." {...register("api_key")} />
            {errors.api_key && <p className="text-xs text-destructive">{errors.api_key.message}</p>}
            {config?.has_api_key && <p className="text-xs text-muted-foreground">{t("apiKeyConfigured")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model">{t("model")}</Label>
            <Input id="model" placeholder="gpt-4o-mini" {...register("model")} />
            {errors.model && <p className="text-xs text-destructive">{errors.model.message}</p>}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="auto-summarize">{t("autoSummarize")}</Label>
          <p className="text-xs text-muted-foreground">{t("autoSummarizeDescription")}</p>
        </div>
        <Switch
          id="auto-summarize"
          checked={autoSummarize}
          onCheckedChange={(checked) => setReader({ autoSummarize: checked })}
        />
      </div>

      <Separator />

      {/* Per-Feature Configs */}
      {(["translate", "summary", "chat"] as FeatureName[]).map((feature) => {
        const fs = featureState[feature];
        const setFs = featureSetters[feature];
        const isOpen = expanded[feature];

        return (
          <div key={feature} className="rounded-md border">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50"
              onClick={() => setExpanded((prev) => ({ ...prev, [feature]: !prev[feature] }))}
            >
              <div className="flex items-center gap-3">
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                <span className="text-sm font-medium">{t(FEATURE_LABELS[feature])}</span>
              </div>
              <Switch
                checked={fs.enabled}
                onCheckedChange={(checked) => setFs({ ...fs, enabled: checked })}
                onClick={(e) => e.stopPropagation()}
              />
            </button>

            {isOpen && fs.enabled && (
              <div className="space-y-3 px-4 pb-4">
                <div className="space-y-1.5">
                  <Label>{t("baseUrl")}</Label>
                  <Input
                    value={fs.base_url}
                    onChange={(e) => setFs({ ...fs, base_url: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("apiKey")}</Label>
                  <Input
                    type="password"
                    value={fs.api_key}
                    onChange={(e) => setFs({ ...fs, api_key: e.target.value })}
                    placeholder="sk-..."
                  />
                  {fs.api_key === "********" && (
                    <p className="text-xs text-muted-foreground">{t("apiKeyConfigured")}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("model")}</Label>
                  <Input
                    value={fs.model}
                    onChange={(e) => setFs({ ...fs, model: e.target.value })}
                    placeholder="gpt-4o-mini"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Separator />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={updateConfig.isPending}>
          {updateConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("save", { ns: "common" })}
        </Button>
        <Button type="button" variant="outline" onClick={handleTest} disabled={testStatus === "testing"}>
          {testStatus === "testing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("testConnection")}
        </Button>
        {testStatus === "success" && (
          <span className="flex items-center gap-1 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" /> {t("ok", { ns: "common" })}
          </span>
        )}
        {testStatus === "error" && (
          <span className="flex items-center gap-1 text-sm text-destructive">
            <XCircle className="h-4 w-4" /> {testError}
          </span>
        )}
      </div>
    </form>
  );
}

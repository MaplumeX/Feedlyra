import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "@/lib/i18n-zod";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAIConfig, useUpdateAIConfig } from "@/api/hooks";
import { useReaderStore } from "@/stores/reader";

const aiConfigSchema = z.object({
  base_url: z.string().url().or(z.literal("")),
  api_key: z.string().or(z.literal("")),
  model: z.string().min(1),
});

type AIConfigForm = z.infer<typeof aiConfigSchema>;

export function AISettingsTab() {
  const { t } = useTranslation("settings");
  const { data: config, isLoading } = useAIConfig();
  const updateConfig = useUpdateAIConfig();
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState("");

  const { autoSummarize, set: setReader } = useReaderStore();

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<AIConfigForm>({
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

  const onSubmit = (data: AIConfigForm) => {
    const payload: Record<string, string | null> = {};
    if (data.base_url) payload.base_url = data.base_url;
    if (data.api_key && data.api_key !== "********") payload.api_key = data.api_key;
    if (data.model) payload.model = data.model;

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="base_url">{t("baseUrl")}</Label>
        <Input
          id="base_url"
          placeholder="https://api.openai.com/v1"
          {...register("base_url")}
        />
        {errors.base_url && (
          <p className="text-xs text-destructive">{errors.base_url.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="api_key">{t("apiKey")}</Label>
        <Input
          id="api_key"
          type="password"
          placeholder="sk-..."
          {...register("api_key")}
        />
        {errors.api_key && (
          <p className="text-xs text-destructive">{errors.api_key.message}</p>
        )}
        {config?.has_api_key && (
          <p className="text-xs text-muted-foreground">{t("apiKeyConfigured")}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="model">{t("model")}</Label>
        <Input
          id="model"
          placeholder="gpt-4o-mini"
          {...register("model")}
        />
        {errors.model && (
          <p className="text-xs text-destructive">{errors.model.message}</p>
        )}
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

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={updateConfig.isPending || !isDirty}>
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
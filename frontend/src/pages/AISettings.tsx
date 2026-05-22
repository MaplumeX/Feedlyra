import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAIConfig, useUpdateAIConfig } from "@/api/hooks";
import { useNavigate } from "react-router";

const aiConfigSchema = z.object({
  base_url: z.string().url("Invalid URL").or(z.literal("")),
  api_key: z.string().or(z.literal("")),
  model: z.string().min(1, "Model is required"),
});

type AIConfigForm = z.infer<typeof aiConfigSchema>;

export function AISettings() {
  const { data: config, isLoading } = useAIConfig();
  const updateConfig = useUpdateAIConfig();
  const navigate = useNavigate();
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState("");

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
      // Test by making a summarize request to a dummy endpoint
      // This verifies the API key and connection are actually valid
      const res = await fetch(`${API_BASE}/api/ai/test-connection`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: "Connection failed" }));
        setTestStatus("error");
        setTestError(data.detail ?? "Connection failed");
        return;
      }
      setTestStatus("success");
    } catch {
      setTestStatus("error");
      setTestError("Connection failed");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">AI Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>BYOK Configuration</CardTitle>
          <CardDescription>
            Configure your own OpenAI-compatible API endpoint. Supports OpenAI, Ollama, DeepSeek,
            Groq, Together AI, and any OpenAI-compatible provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="base_url">Base URL</Label>
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
              <Label htmlFor="api_key">API Key</Label>
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
                <p className="text-xs text-muted-foreground">API key is already configured</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                placeholder="gpt-4o-mini"
                {...register("model")}
              />
              {errors.model && (
                <p className="text-xs text-destructive">{errors.model.message}</p>
              )}
            </div>

            <Separator />

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={updateConfig.isPending || !isDirty}>
                {updateConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
              <Button type="button" variant="outline" onClick={handleTest} disabled={testStatus === "testing"}>
                {testStatus === "testing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Connection
              </Button>
              {testStatus === "success" && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> OK
                </span>
              )}
              {testStatus === "error" && (
                <span className="flex items-center gap-1 text-sm text-destructive">
                  <XCircle className="h-4 w-4" /> {testError}
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "@/lib/i18n-zod";
import { useNavigate, Link } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "@/api/client";
import { resolveAuthError } from "@/lib/auth-errors";
import type { User } from "@/api/types";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Rss } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    try {
      const tokens = await api.post<{ access_token: string; refresh_token: string }>("/api/auth/login", data);
      setTokens(tokens.access_token, tokens.refresh_token);
      const user = await api.get<User>("/api/auth/me");
      setUser(user);
      navigate("/");
    } catch (error) {
      toast.error(t(resolveAuthError(error)));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-sm mx-4">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Rss className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold font-heading">Feedlyra</h1>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold font-heading">{t("login")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("signInToAccount")}</p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input id="password" type="password" {...register("password")} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("signingIn") : t("signIn")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("noAccount")} <Link to="/register" className="text-primary hover:underline">{t("register")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

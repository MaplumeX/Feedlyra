import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "@/lib/i18n-zod";
import { useNavigate, Link } from "react-router";
import { useTranslation } from "react-i18next";
import { api } from "@/api/client";
import type { User } from "@/api/types";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

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
    const tokens = await api.post<{ access_token: string; refresh_token: string }>("/api/auth/login", data);
    setTokens(tokens.access_token, tokens.refresh_token);
    const user = await api.get<User>("/api/auth/me");
    setUser(user);
    navigate("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("login")}</CardTitle>
          <CardDescription>{t("signInToAccount")}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
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
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("signingIn") : t("signIn")}
            </Button>
            <p className="text-sm text-muted-foreground">
              {t("noAccount")} <Link to="/register" className="text-primary underline">{t("register")}</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

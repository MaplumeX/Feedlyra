import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "@/lib/i18n-zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCurrentUser, useUpdateEmail, useUpdatePassword, useUpdateProfile } from "@/api/hooks";
import { useAuthStore } from "@/stores/auth";

const profileSchema = z.object({
  username: z.string().min(3).regex(/^[a-zA-Z0-9_]+$/),
});

const emailSchema = z.object({
  email: z.string().email(),
  currentPassword: z.string().min(8),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    params: { i18n: "passwordsDoNotMatch" },
    path: ["confirmPassword"],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type EmailForm = z.infer<typeof emailSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export function AccountSettingsTab() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const { data: currentUser } = useCurrentUser();
  const user = currentUser ?? authUser;

  const updateProfile = useUpdateProfile();
  const updateEmail = useUpdateEmail();
  const updatePassword = useUpdatePassword();

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { username: user?.username ?? "" },
  });

  const {
    register: registerEmail,
    handleSubmit: handleEmailSubmit,
    reset: resetEmail,
    formState: { errors: emailErrors },
  } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: user?.email ?? "", currentPassword: "" },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!user) return;
    resetProfile({ username: user.username });
    resetEmail({ email: user.email, currentPassword: "" });
  }, [resetEmail, resetProfile, user]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const onProfileSubmit = (data: ProfileForm) => {
    updateProfile.mutate(data, {
      onSuccess: (updatedUser) => {
        setUser(updatedUser);
        toast.success(t("accountUpdated"));
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const onEmailSubmit = (data: EmailForm) => {
    updateEmail.mutate(
      { email: data.email, current_password: data.currentPassword },
      {
        onSuccess: (updatedUser) => {
          setUser(updatedUser);
          resetEmail({ email: updatedUser.email, currentPassword: "" });
          toast.success(t("emailUpdated"));
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const onPasswordSubmit = (data: PasswordForm) => {
    updatePassword.mutate(
      { current_password: data.currentPassword, new_password: data.newPassword },
      {
        onSuccess: () => {
          resetPassword();
          toast.success(t("passwordUpdated"));
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{t("accountProfile")}</h3>
        <p className="text-xs text-muted-foreground">{t("accountProfileDescription")}</p>
      </div>

      <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="account-username">{t("username")}</Label>
          <Input id="account-username" autoComplete="username" {...registerProfile("username")} />
          {profileErrors.username && <p className="text-xs text-destructive">{profileErrors.username.message}</p>}
        </div>
        <Button type="submit" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? t("saving", { ns: "common" }) : t("saveProfile")}
        </Button>
      </form>

      <Separator />

      <form onSubmit={handleEmailSubmit(onEmailSubmit)} className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{t("emailAddress")}</h3>
          <p className="text-xs text-muted-foreground">{t("emailChangeDescription")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-email">{t("email")}</Label>
          <Input id="account-email" type="email" autoComplete="email" {...registerEmail("email")} />
          {emailErrors.email && <p className="text-xs text-destructive">{emailErrors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email-current-password">{t("currentPassword")}</Label>
          <Input id="email-current-password" type="password" autoComplete="current-password" {...registerEmail("currentPassword")} />
          {emailErrors.currentPassword && <p className="text-xs text-destructive">{emailErrors.currentPassword.message}</p>}
        </div>
        <Button type="submit" disabled={updateEmail.isPending}>
          {updateEmail.isPending ? t("saving", { ns: "common" }) : t("saveEmail")}
        </Button>
      </form>

      <Separator />

      <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{t("password")}</h3>
          <p className="text-xs text-muted-foreground">{t("passwordDescription")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password-current">{t("currentPassword")}</Label>
          <Input id="password-current" type="password" autoComplete="current-password" {...registerPassword("currentPassword")} />
          {passwordErrors.currentPassword && <p className="text-xs text-destructive">{passwordErrors.currentPassword.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password-new">{t("newPassword")}</Label>
          <Input id="password-new" type="password" autoComplete="new-password" {...registerPassword("newPassword")} />
          {passwordErrors.newPassword && <p className="text-xs text-destructive">{passwordErrors.newPassword.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password-confirm">{t("confirmPassword")}</Label>
          <Input id="password-confirm" type="password" autoComplete="new-password" {...registerPassword("confirmPassword")} />
          {passwordErrors.confirmPassword && <p className="text-xs text-destructive">{passwordErrors.confirmPassword.message}</p>}
        </div>
        <Button type="submit" disabled={updatePassword.isPending}>
          {updatePassword.isPending ? t("saving", { ns: "common" }) : t("changePassword")}
        </Button>
      </form>

      <Separator />

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">{t("session")}</h3>
          <p className="text-xs text-muted-foreground">{t("sessionDescription")}</p>
        </div>
        <Button type="button" variant="outline" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          {t("logout")}
        </Button>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "@/lib/i18n-zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUpdatePassword } from "@/api/hooks";

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

type PasswordForm = z.infer<typeof passwordSchema>;

interface EditPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPasswordDialog({ open, onOpenChange }: EditPasswordDialogProps) {
  const { t } = useTranslation("settings");
  const updatePassword = useUpdatePassword();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (open) {
      reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
    }
  }, [reset, open]);

  const onSubmit = (data: PasswordForm) => {
    updatePassword.mutate(
      { current_password: data.currentPassword, new_password: data.newPassword },
      {
        onSuccess: () => {
          reset();
          toast.success(t("passwordUpdated"));
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("editPassword")}</DialogTitle>
          <DialogDescription>{t("passwordDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-password-current">{t("currentPassword")}</Label>
            <Input id="edit-password-current" type="password" autoComplete="current-password" {...register("currentPassword")} />
            {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-password-new">{t("newPassword")}</Label>
            <Input id="edit-password-new" type="password" autoComplete="new-password" {...register("newPassword")} />
            {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-password-confirm">{t("confirmPassword")}</Label>
            <Input id="edit-password-confirm" type="password" autoComplete="new-password" {...register("confirmPassword")} />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updatePassword.isPending}>
              {updatePassword.isPending ? t("saving", { ns: "common" }) : t("changePassword")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

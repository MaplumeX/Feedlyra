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
import { useCurrentUser, useUpdateEmail } from "@/api/hooks";
import { useAuthStore } from "@/stores/auth";

const emailSchema = z.object({
  email: z.string().email(),
  currentPassword: z.string().min(8),
});

type EmailForm = z.infer<typeof emailSchema>;

interface EditEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditEmailDialog({ open, onOpenChange }: EditEmailDialogProps) {
  const { t } = useTranslation("settings");
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const { data: currentUser } = useCurrentUser();
  const user = currentUser ?? authUser;

  const updateEmail = useUpdateEmail();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: user?.email ?? "", currentPassword: "" },
  });

  useEffect(() => {
    if (!user) return;
    reset({ email: user.email, currentPassword: "" });
  }, [reset, user, open]);

  const onSubmit = (data: EmailForm) => {
    updateEmail.mutate(
      { email: data.email, current_password: data.currentPassword },
      {
        onSuccess: (updatedUser) => {
          setUser(updatedUser);
          reset({ email: updatedUser.email, currentPassword: "" });
          toast.success(t("emailUpdated"));
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
          <DialogTitle>{t("editEmail")}</DialogTitle>
          <DialogDescription>{t("emailChangeDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">{t("email")}</Label>
            <Input id="edit-email" type="email" autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email-current-password">{t("currentPassword")}</Label>
            <Input id="edit-email-current-password" type="password" autoComplete="current-password" {...register("currentPassword")} />
            {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateEmail.isPending}>
              {updateEmail.isPending ? t("saving", { ns: "common" }) : t("saveEmail")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

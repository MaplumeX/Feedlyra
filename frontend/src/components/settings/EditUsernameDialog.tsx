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
import { useCurrentUser, useUpdateProfile } from "@/api/hooks";
import { useAuthStore } from "@/stores/auth";

const profileSchema = z.object({
  username: z.string().min(3).regex(/^[a-zA-Z0-9_]+$/),
});

type ProfileForm = z.infer<typeof profileSchema>;

interface EditUsernameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUsernameDialog({ open, onOpenChange }: EditUsernameDialogProps) {
  const { t } = useTranslation("settings");
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const { data: currentUser } = useCurrentUser();
  const user = currentUser ?? authUser;

  const updateProfile = useUpdateProfile();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { username: user?.username ?? "" },
  });

  useEffect(() => {
    if (!user) return;
    reset({ username: user.username });
  }, [reset, user, open]);

  const onSubmit = (data: ProfileForm) => {
    updateProfile.mutate(data, {
      onSuccess: (updatedUser) => {
        setUser(updatedUser);
        toast.success(t("accountUpdated"));
        onOpenChange(false);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("editUsername")}</DialogTitle>
          <DialogDescription>{t("accountProfileDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-username">{t("username")}</Label>
            <Input id="edit-username" autoComplete="username" {...register("username")} />
            {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? t("saving", { ns: "common" }) : t("saveProfile")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

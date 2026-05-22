import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const languages = [
  { code: "en" as const, name: "English" },
  { code: "zh-CN" as const, name: "简体中文" },
];

export function GeneralSettingsTab() {
  const { t, i18n } = useTranslation("settings");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("language", { ns: "common" })}</Label>
        <div className="flex gap-2">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => i18n.changeLanguage(lang.code)}
              className={cn(
                "rounded-md border px-4 py-2 text-sm transition-colors",
                i18n.language.startsWith(lang.code)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {lang.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
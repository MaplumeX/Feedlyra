import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useReaderStore } from "@/stores/reader";
import { useColorScheme } from "@/hooks/useColorScheme";
import { COLOR_SCHEMES } from "@/lib/colorScheme";
import { cn } from "@/lib/utils";

const languages = [
  { code: "en" as const, name: "English" },
  { code: "zh-CN" as const, name: "简体中文" },
];

const chatModes = [
  { value: "sidebar" as const, labelKey: "chatModeSidebar" },
  { value: "floating" as const, labelKey: "chatModeFloating" },
];

export function GeneralSettingsTab() {
  const { t, i18n } = useTranslation("settings");
  const { scrollMarkRead, chatPanelMode, set: setReader } = useReaderStore();
  const { scheme, setScheme } = useColorScheme();

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
      <div className="space-y-2">
        <Label>{t("accentColor")}</Label>
        <div className="flex gap-2">
          {COLOR_SCHEMES.map((option) => (
            <button
              key={option.value}
              onClick={() => setScheme(option.value)}
              title={t(option.labelKey)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors",
                scheme === option.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <span
                className="h-3 w-3 rounded-full border border-black/10"
                style={{ backgroundColor: option.swatch }}
              />
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="scroll-mark-read">{t("scrollMarkRead")}</Label>
        <Switch
          id="scroll-mark-read"
          checked={scrollMarkRead}
          onCheckedChange={(checked) => setReader({ scrollMarkRead: checked })}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("defaultChatMode")}</Label>
        <div className="flex gap-2">
          {chatModes.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setReader({ chatPanelMode: mode.value })}
              className={cn(
                "rounded-md border px-4 py-2 text-sm transition-colors",
                chatPanelMode === mode.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {t(mode.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

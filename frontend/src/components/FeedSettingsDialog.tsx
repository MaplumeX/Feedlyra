import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateFeed, useCategories, useAutomationRules } from "@/api/hooks";
import { useTranslation } from "react-i18next";
import { useReaderStore } from "@/stores/reader";
import type { Feed } from "@/api/types";
import { Switch } from "@/components/ui/switch";
import { Zap } from "lucide-react";
import { LANGUAGES } from "@/lib/languages";

interface FeedSettingsDialogProps {
  feed: Feed;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UNCATEGORIZED = "__none__";
const LANG_AUTO = "__auto__";

export function FeedSettingsDialog({ feed, open, onOpenChange }: FeedSettingsDialogProps) {
  const { t } = useTranslation("reader");
  const [title, setTitle] = useState(feed.title);
  const [categoryId, setCategoryId] = useState<string>(feed.category_id ?? UNCATEGORIZED);
  const [autoFullText, setAutoFullText] = useState(feed.auto_full_text);
  const [autoTranslate, setAutoTranslate] = useState(feed.auto_translate);
  const [translateTargetLang, setTranslateTargetLang] = useState<string>(
    feed.translate_target_lang ?? LANG_AUTO,
  );
  const updateFeed = useUpdateFeed();
  const { data: categories = [] } = useCategories();
  const { data: automationData } = useAutomationRules({ scope: "feed", scope_id: feed.id });
  const setReader = useReaderStore((s) => s.set);
  const feedRuleCount = automationData?.length ?? 0;

  useEffect(() => {
    setTitle(feed.title);
    setCategoryId(feed.category_id ?? UNCATEGORIZED);
    setAutoFullText(feed.auto_full_text);
    setAutoTranslate(feed.auto_translate);
    setTranslateTargetLang(feed.translate_target_lang ?? LANG_AUTO);
  }, [feed.title, feed.category_id, feed.auto_full_text, feed.auto_translate, feed.translate_target_lang]);

  function handleSave() {
    const trimmedTitle = title.trim();
    const catId = categoryId === UNCATEGORIZED ? null : categoryId;
    const targetLang = translateTargetLang === LANG_AUTO ? null : translateTargetLang;
    if (!trimmedTitle) return;
    if (
      trimmedTitle === feed.title &&
      catId === feed.category_id &&
      autoFullText === feed.auto_full_text &&
      autoTranslate === feed.auto_translate &&
      targetLang === feed.translate_target_lang
    ) return;
    updateFeed.mutate(
      {
        feedId: feed.id,
        title: trimmedTitle,
        category_id: catId,
        auto_full_text: autoFullText,
        auto_translate: autoTranslate,
        translate_target_lang: targetLang,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  const isSaveDisabled =
    !title.trim() ||
    (title === feed.title &&
      categoryId === (feed.category_id ?? UNCATEGORIZED) &&
      autoFullText === feed.auto_full_text &&
      autoTranslate === feed.auto_translate &&
      (translateTargetLang === LANG_AUTO ? null : translateTargetLang) === feed.translate_target_lang) ||
    updateFeed.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("feedSettings")}</DialogTitle>
          <DialogDescription>{t("feedSettingsDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-muted-foreground">{t("feedUrl")}</Label>
            <p className="mt-1 break-all text-sm">{feed.url}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">{t("feedSiteUrl")}</Label>
            <p className="mt-1 break-all text-sm">{feed.site_url ?? "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">{t("description", { ns: "common" })}</Label>
            <p className="mt-1 text-sm">{feed.description ?? "N/A"}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="feed-title">{t("feedTitle")}</Label>
          <Input
            id="feed-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("category")}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNCATEGORIZED}>{t("uncategorized")}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="auto-full-text">{t("autoFullText")}</Label>
          <Switch
            id="auto-full-text"
            checked={autoFullText}
            onCheckedChange={setAutoFullText}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="auto-translate">{t("autoTranslate")}</Label>
          <Switch
            id="auto-translate"
            checked={autoTranslate}
            onCheckedChange={setAutoTranslate}
          />
        </div>

        {autoTranslate && (
          <div className="space-y-2">
            <Label>{t("translateTargetLang")}</Label>
            <Select value={translateTargetLang} onValueChange={setTranslateTargetLang}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={LANG_AUTO}>{t("translateLangAuto")}</SelectItem>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {updateFeed.isError && (
          <p className="text-sm text-destructive">{updateFeed.error.message}</p>
        )}

        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span>{t("automation.title", { ns: "settings" })}</span>
            {feedRuleCount > 0 && (
              <span className="text-xs text-muted-foreground">({feedRuleCount})</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              onOpenChange(false);
              setReader({ settingsDialogOpen: true, settingsDialogTab: "automation" });
            }}
          >
            {t("automation.manage", { ns: "settings" })}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel", { ns: "common" })}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaveDisabled}
          >
            {updateFeed.isPending ? t("saving", { ns: "common" }) : t("save", { ns: "common" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

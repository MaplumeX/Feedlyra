import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories, useFeeds, useCreateAutomationRule, useUpdateAutomationRule } from "@/api/hooks";
import { LANGUAGES } from "@/lib/languages";
import { cn } from "@/lib/utils";
import type { AutomationRule, AutomationCondition, AutomationAction } from "@/api/types";

interface RuleEditorDialogProps {
  rule: AutomationRule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultScope?: "global" | "category" | "feed";
  defaultScopeId?: string | null;
}

const FIELDS = ["title", "author", "url", "content"] as const;
const OPERATORS = ["contains", "not_contains", "matches_regex"] as const;
const LOGIC_OPTIONS = ["and", "or"] as const;

const FIELD_LABEL_KEYS: Record<string, string> = {
  title: "automation.fieldTitle",
  author: "automation.fieldAuthor",
  url: "automation.fieldUrl",
  content: "automation.fieldContent",
};

const OPERATOR_LABEL_KEYS: Record<string, string> = {
  contains: "automation.opContains",
  not_contains: "automation.opNotContains",
  matches_regex: "automation.opMatchesRegex",
};

const ACTION_TYPES: { type: AutomationAction["type"]; labelKey: string; needsLang?: boolean }[] = [
  { type: "mark_read", labelKey: "automation.actionMarkRead" },
  { type: "star", labelKey: "automation.actionStar" },
  { type: "delete", labelKey: "automation.actionDelete" },
  { type: "auto_translate", labelKey: "automation.actionAutoTranslate", needsLang: true },
  { type: "auto_extract", labelKey: "automation.actionAutoExtract" },
];

function emptyCondition(): AutomationCondition {
  return { field: "title", operator: "contains", value: "", logic: "and" };
}

export function RuleEditorDialog({ rule, open, onOpenChange, defaultScope, defaultScopeId }: RuleEditorDialogProps) {
  const { t } = useTranslation("settings");
  const { data: categories = [] } = useCategories();
  const { data: feeds = [] } = useFeeds();
  const createRule = useCreateAutomationRule();
  const updateRule = useUpdateAutomationRule();

  const [name, setName] = useState("");
  const [scope, setScope] = useState<"global" | "category" | "feed">("global");
  const [scopeId, setScopeId] = useState<string>("");
  const [conditions, setConditions] = useState<AutomationCondition[]>([emptyCondition()]);
  const [actionToggles, setActionToggles] = useState<Record<string, boolean>>({});
  const [translateLang, setTranslateLang] = useState("zh");
  const [enabled, setEnabled] = useState(true);

  const isEditing = rule !== null;
  const isPending = createRule.isPending || updateRule.isPending;

  useEffect(() => {
    if (!open) return;
    if (rule) {
      setName(rule.name);
      setScope(rule.scope);
      setScopeId(rule.scope_id ?? "");
      setConditions(rule.conditions.length > 0 ? rule.conditions : [emptyCondition()]);
      setEnabled(rule.enabled);
      const toggles: Record<string, boolean> = {};
      let lang = "zh";
      for (const action of rule.actions) {
        toggles[action.type] = true;
        if (action.type === "auto_translate" && action.params?.translate_target_lang) {
          lang = action.params.translate_target_lang;
        }
      }
      setActionToggles(toggles);
      setTranslateLang(lang);
    } else {
      setName("");
      setScope(defaultScope ?? "global");
      setScopeId(defaultScopeId ?? "");
      setConditions([emptyCondition()]);
      setEnabled(true);
      setActionToggles({});
      setTranslateLang("zh");
    }
  }, [rule, open, defaultScope, defaultScopeId]);

  function addCondition() {
    setConditions((prev) => [...prev, emptyCondition()]);
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, updates: Partial<AutomationCondition>) {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...updates } : c)),
    );
  }

  function toggleAction(type: string, checked: boolean) {
    setActionToggles((prev) => ({ ...prev, [type]: checked }));
  }

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const finalScopeId = scope === "global" ? null : scopeId || null;

    const actions: AutomationAction[] = [];
    for (const at of ACTION_TYPES) {
      if (actionToggles[at.type]) {
        const action: AutomationAction = { type: at.type };
        if (at.type === "auto_translate") {
          action.params = { translate_target_lang: translateLang };
        }
        actions.push(action);
      }
    }

    if (actions.length === 0) return;

    const validConditions = conditions.filter((c) => c.value.trim() !== "");

    if (isEditing && rule) {
      updateRule.mutate(
        {
          ruleId: rule.id,
          name: trimmedName,
          enabled,
          scope,
          scope_id: finalScopeId,
          conditions: validConditions,
          actions,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createRule.mutate(
        {
          name: trimmedName,
          scope,
          scope_id: finalScopeId,
          conditions: validConditions,
          actions,
          enabled,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  }

  const hasDelete = !!actionToggles["delete"];
  const otherActionsCount = Object.entries(actionToggles).filter(
    ([type, checked]) => checked && type !== "delete",
  ).length;
  const hasConflict = hasDelete && otherActionsCount > 0;
  const noActionsSelected = Object.values(actionToggles).every((v) => !v);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[calc(100vh-4rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t("automation.editRuleTitle") : t("automation.createRuleTitle")}</DialogTitle>
          <DialogDescription>
            {isEditing ? t("automation.editRuleDescription") : t("automation.createRuleDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="rule-name">{t("automation.ruleName")}</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="rule-enabled" className="text-xs text-muted-foreground">{t("automation.enabled")}</Label>
                <Switch id="rule-enabled" checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("automation.ruleNamePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("automation.scope")}</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as "global" | "category" | "feed")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">{t("automation.scopeGlobal")}</SelectItem>
                <SelectItem value="category">{t("automation.scopeCategory")}</SelectItem>
                <SelectItem value="feed">{t("automation.scopeFeed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "category" && (
            <div className="space-y-2">
              <Label>{t("automation.category")}</Label>
              <Select value={scopeId} onValueChange={setScopeId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("automation.categoryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {scope === "feed" && (
            <div className="space-y-2">
              <Label>{t("automation.feed")}</Label>
              <Select value={scopeId} onValueChange={setScopeId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("automation.feedPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {feeds.map((feed) => (
                    <SelectItem key={feed.id} value={feed.id}>{feed.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Conditions */}
          <div className="space-y-3">
            <Label>{t("automation.conditions")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("automation.conditionsDescription")}
            </p>
            {conditions.map((condition, index) => (
              <div key={index} className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  {index > 0 && (
                    <Select
                      value={condition.logic}
                      onValueChange={(v) => updateCondition(index, { logic: v as "and" | "or" })}
                    >
                      <SelectTrigger className={cn(
                        "h-7 w-16 text-xs shrink-0",
                        condition.logic === "or" && "border-orange-400 bg-orange-50 text-orange-700 dark:border-orange-600 dark:bg-orange-950/30 dark:text-orange-300",
                      )}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOGIC_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt} className="text-xs">
                            {opt.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {index === 0 && <div className="w-16 shrink-0" />}
                  <Select
                    value={condition.field}
                    onValueChange={(v) => updateCondition(index, { field: v as AutomationCondition["field"] })}
                  >
                    <SelectTrigger className="h-7 flex-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELDS.map((f) => (
                        <SelectItem key={f} value={f} className="text-xs">
                          {t(FIELD_LABEL_KEYS[f]!)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={condition.operator}
                    onValueChange={(v) => updateCondition(index, { operator: v as AutomationCondition["operator"] })}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op} value={op} className="text-xs">
                          {t(OPERATOR_LABEL_KEYS[op]!)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={condition.value}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    placeholder={t("automation.valuePlaceholder")}
                    className="h-7 flex-1 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground"
                    onClick={() => removeCondition(index)}
                    disabled={conditions.length <= 1}
                    title={t("automation.removeCondition")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={addCondition}
            >
              <Plus className="mr-1 h-3 w-3" />
              {t("automation.addCondition")}
            </Button>
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-3">
            <Label>{t("automation.actions")}</Label>
            {hasConflict && (
              <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{t("automation.conflictWarning")}</span>
              </div>
            )}
            <div className="space-y-2">
              {ACTION_TYPES.map((at) => (
                <div key={at.type}>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <Label htmlFor={`action-${at.type}`} className="text-sm cursor-pointer">
                      {t(at.labelKey)}
                    </Label>
                    <Switch
                      id={`action-${at.type}`}
                      checked={!!actionToggles[at.type]}
                      onCheckedChange={(checked) => toggleAction(at.type, checked)}
                    />
                  </div>
                  {at.needsLang && actionToggles[at.type] && (
                    <div className="mt-1.5 ml-4 flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">{t("automation.targetLanguage")}</Label>
                      <Select value={translateLang} onValueChange={setTranslateLang}>
                        <SelectTrigger className="h-7 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>
                              {lang.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {noActionsSelected && (
              <p className="text-xs text-destructive">{t("automation.selectAction")}</p>
            )}
          </div>
        </div>

        {(createRule.isError || updateRule.isError) && (
          <p className="text-sm text-destructive">
            {(createRule.error ?? updateRule.error)?.message}
          </p>
        )}

        <DialogFooter>
          {hasConflict && (
            <p className="flex items-center gap-1 text-xs text-warning">
              <AlertTriangle className="h-3 w-3" />
              {t("automation.conflictBlockingHint")}
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("automation.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending || !name.trim() || noActionsSelected || hasConflict}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? t("automation.save") : t("automation.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

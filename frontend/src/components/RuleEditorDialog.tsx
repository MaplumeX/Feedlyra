import { useState, useEffect } from "react";
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

const FIELD_LABELS: Record<string, string> = {
  title: "Title", // TODO: i18n
  author: "Author", // TODO: i18n
  url: "URL", // TODO: i18n
  content: "Content", // TODO: i18n
};

const OPERATOR_LABELS: Record<string, string> = {
  contains: "contains", // TODO: i18n
  not_contains: "not contains", // TODO: i18n
  matches_regex: "matches regex", // TODO: i18n
};

const ACTION_TYPES: { type: AutomationAction["type"]; label: string; needsLang?: boolean }[] = [
  { type: "mark_read", label: "Mark as Read" }, // TODO: i18n
  { type: "star", label: "Star" }, // TODO: i18n
  { type: "delete", label: "Delete (skip)" }, // TODO: i18n
  { type: "auto_translate", label: "Auto Translate", needsLang: true }, // TODO: i18n
  { type: "auto_extract", label: "Auto Extract Full Text" }, // TODO: i18n
];

function emptyCondition(): AutomationCondition {
  return { field: "title", operator: "contains", value: "", logic: "and" };
}

export function RuleEditorDialog({ rule, open, onOpenChange, defaultScope, defaultScopeId }: RuleEditorDialogProps) {
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
          <DialogTitle>{isEditing ? "Edit Rule" : "Create Rule"}</DialogTitle> {/* TODO: i18n */}
          <DialogDescription>
            {isEditing ? "Modify this automation rule" : "Define conditions and actions for new articles"} {/* TODO: i18n */}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="rule-name">Rule Name</Label> {/* TODO: i18n */}
              <div className="flex items-center gap-2">
                <Label htmlFor="rule-enabled" className="text-xs text-muted-foreground">Enabled</Label> {/* TODO: i18n */}
                <Switch id="rule-enabled" checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Auto-read marketing emails" // TODO: i18n
            />
          </div>

          <div className="space-y-2">
            <Label>Scope</Label> {/* TODO: i18n */}
            <Select value={scope} onValueChange={(v) => setScope(v as "global" | "category" | "feed")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (all feeds)</SelectItem> {/* TODO: i18n */}
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="feed">Feed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "category" && (
            <div className="space-y-2">
              <Label>Category</Label> {/* TODO: i18n */}
              <Select value={scopeId} onValueChange={setScopeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." /> {/* TODO: i18n */}
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
              <Label>Feed</Label> {/* TODO: i18n */}
              <Select value={scopeId} onValueChange={setScopeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select feed..." /> {/* TODO: i18n */}
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
            <Label>Conditions</Label> {/* TODO: i18n */}
            <p className="text-xs text-muted-foreground">
              Match articles when all AND conditions and any OR conditions are satisfied {/* TODO: i18n */}
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
                          {FIELD_LABELS[f]}
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
                          {OPERATOR_LABELS[op]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={condition.value}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    placeholder="Value" // TODO: i18n
                    className="h-7 flex-1 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground"
                    onClick={() => removeCondition(index)}
                    disabled={conditions.length <= 1}
                    title="Remove condition" // TODO: i18n
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
              Add Condition {/* TODO: i18n */}
            </Button>
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-3">
            <Label>Actions</Label> {/* TODO: i18n */}
            {hasConflict && (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Delete takes precedence — other actions won&apos;t have effect</span> {/* TODO: i18n */}
              </div>
            )}
            <div className="space-y-2">
              {ACTION_TYPES.map((at) => (
                <div key={at.type}>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <Label htmlFor={`action-${at.type}`} className="text-sm cursor-pointer">
                      {at.label}
                    </Label>
                    <Switch
                      id={`action-${at.type}`}
                      checked={!!actionToggles[at.type]}
                      onCheckedChange={(checked) => toggleAction(at.type, checked)}
                    />
                  </div>
                  {at.needsLang && actionToggles[at.type] && (
                    <div className="mt-1.5 ml-4 flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Target Language</Label> {/* TODO: i18n */}
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
              /* TODO: i18n */
              <p className="text-xs text-destructive">Select at least one action</p>
            )}
          </div>
        </div>

        {(createRule.isError || updateRule.isError) && (
          <p className="text-sm text-destructive">
            {(createRule.error ?? updateRule.error)?.message}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel {/* TODO: i18n */}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending || !name.trim() || noActionsSelected}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Save" : "Create"} {/* TODO: i18n */}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

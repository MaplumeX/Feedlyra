import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Pencil, Trash2, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useAutomationRules,
  useDeleteAutomationRule,
  useToggleAutomationRule,
} from "@/api/hooks";
import { RuleEditorDialog } from "@/components/RuleEditorDialog";
import { cn } from "@/lib/utils";
import type { AutomationRule } from "@/api/types";

const SCOPE_LABEL_KEYS: Record<AutomationRule["scope"], string> = {
  global: "automation.scopeGlobalShort",
  category: "automation.scopeCategoryShort",
  feed: "automation.scopeFeedShort",
};

const ACTION_LABEL_KEYS: Record<string, string> = {
  mark_read: "automation.actionMarkReadShort",
  star: "automation.actionStarShort",
  delete: "automation.actionDeleteShort",
  auto_translate: "automation.actionAutoTranslateShort",
  auto_extract: "automation.actionAutoExtractShort",
};

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

const ACTION_COLORS: Record<string, string> = {
  mark_read: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  star: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  delete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  auto_translate: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  auto_extract: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

function conditionSummary(conditions: AutomationRule["conditions"], t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (conditions.length === 0) return t("automation.noConditions");
  return conditions
    .map((c, i) => {
      const prefix = i === 0 ? "" : c.logic === "or" ? ` ${t("automation.logicOr")} ` : ` ${t("automation.logicAnd")} `;
      const field = t(FIELD_LABEL_KEYS[c.field] ?? "automation.fieldTitle");
      const op = t(OPERATOR_LABEL_KEYS[c.operator] ?? "automation.opContains");
      const truncated = c.value.length > 20;
      const val = truncated ? c.value.slice(0, 20) : c.value;
      const template = truncated ? "automation.conditionSummaryTruncated" : "automation.conditionSummary";
      return `${prefix}${t(template, { field, operator: op, value: val })}`;
    })
    .join("");
}

export function AutomationTab() {
  const { t } = useTranslation("settings");
  const { data, isLoading } = useAutomationRules();
  const toggleRule = useToggleAutomationRule();
  const deleteRule = useDeleteAutomationRule();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  const rules = data ?? [];

  const globalRules = rules.filter((r) => r.scope === "global");
  const categoryRules = rules.filter((r) => r.scope === "category");
  const feedRules = rules.filter((r) => r.scope === "feed");

  function handleEdit(rule: AutomationRule) {
    setEditingRule(rule);
    setEditorOpen(true);
  }

  function handleCreate() {
    setEditingRule(null);
    setEditorOpen(true);
  }

  function handleDelete(rule: AutomationRule) {
    if (!window.confirm(t("automation.deleteConfirm", { name: rule.name }))) return;
    deleteRule.mutate(rule.id);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasDeleteAction = (rule: AutomationRule) =>
    rule.actions.some((a) => a.type === "delete");

  function renderRuleGroup(title: string, groupRules: AutomationRule[]) {
    if (groupRules.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
        {groupRules.map((rule) => (
          <div
            key={rule.id}
            className="group flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/30"
          >
            <Switch
              checked={rule.enabled}
              onCheckedChange={(enabled) => toggleRule.mutate({ ruleId: rule.id, enabled })}
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-medium", !rule.enabled && "text-muted-foreground")}>
                  {rule.name}
                </span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {t(SCOPE_LABEL_KEYS[rule.scope])}
                </Badge>
              </div>
              {hasDeleteAction(rule) && rule.actions.length > 1 && (
                <div className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{t("automation.conflictHint")}</span>
                </div>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                {conditionSummary(rule.conditions, t)}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {rule.actions.map((action, i) => (
                  <span
                    key={`${action.type}-${i}`}
                    className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium", ACTION_COLORS[action.type])}
                  >
                    {t(ACTION_LABEL_KEYS[action.type] ?? "automation.actionDeleteShort")}
                    {action.type === "auto_translate" && action.params?.translate_target_lang
                      ? ` (${action.params.translate_target_lang})`
                      : null}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleEdit(rule)}
                title={t("automation.editRule")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => handleDelete(rule)}
                title={t("automation.deleteRule")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Zap className="h-4 w-4" />
          <span>{t("automation.title")}</span>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t("automation.addRule")}
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Zap className="mb-2 h-8 w-8" />
          <p className="text-sm">{t("automation.emptyTitle")}</p>
          <p className="text-xs">{t("automation.emptyDescription")}</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-4">
            {renderRuleGroup(t("automation.groupGlobal"), globalRules)}
            {renderRuleGroup(t("automation.groupCategory"), categoryRules)}
            {renderRuleGroup(t("automation.groupFeed"), feedRules)}
          </div>
        </ScrollArea>
      )}

      <RuleEditorDialog
        rule={editingRule}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
    </div>
  );
}

import { useState } from "react";
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

const SCOPE_LABELS: Record<AutomationRule["scope"], string> = {
  global: "Global", // TODO: i18n
  category: "Category", // TODO: i18n
  feed: "Feed", // TODO: i18n
};

const ACTION_LABELS: Record<string, string> = {
  mark_read: "Mark Read", // TODO: i18n
  star: "Star", // TODO: i18n
  delete: "Delete", // TODO: i18n
  auto_translate: "Auto Translate", // TODO: i18n
  auto_extract: "Auto Extract", // TODO: i18n
};

const ACTION_COLORS: Record<string, string> = {
  mark_read: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  star: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  delete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  auto_translate: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  auto_extract: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

function conditionSummary(conditions: AutomationRule["conditions"]): string {
  if (conditions.length === 0) return "No conditions"; // TODO: i18n
  return conditions
    .map((c, i) => {
      const prefix = i === 0 ? "" : c.logic === "or" ? " OR " : " AND ";
      const field = c.field;
      const op = c.operator === "contains" ? "contains" : c.operator === "not_contains" ? "not contains" : "matches";
      const val = c.value.length > 20 ? c.value.slice(0, 20) + "..." : c.value;
      return `${prefix}${field} ${op} "${val}"`;
    })
    .join("");
}

export function AutomationTab() {
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
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return; // TODO: i18n
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
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
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
                  {SCOPE_LABELS[rule.scope]}
                </Badge>
              </div>
              {hasDeleteAction(rule) && rule.actions.length > 1 && (
                <div className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Delete takes precedence over other actions</span>
                </div>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                {conditionSummary(rule.conditions)}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {rule.actions.map((action, i) => (
                  <span
                    key={`${action.type}-${i}`}
                    className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium", ACTION_COLORS[action.type])}
                  >
                    {ACTION_LABELS[action.type] ?? action.type}
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
                title="Edit rule" // TODO: i18n
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => handleDelete(rule)}
                title="Delete rule" // TODO: i18n
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
          <span>Automation Rules</span> {/* TODO: i18n */}
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Rule {/* TODO: i18n */}
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Zap className="mb-2 h-8 w-8" />
          <p className="text-sm">No automation rules yet</p> {/* TODO: i18n */}
          <p className="text-xs">Create rules to automatically process new articles</p> {/* TODO: i18n */}
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-4">
            {renderRuleGroup("Global", globalRules)}
            {renderRuleGroup("Category", categoryRules)}
            {renderRuleGroup("Feed", feedRules)}
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

import { ArrowUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FeedSortDirection, FeedSortField, FeedSortPreference } from "@/lib/feedSort";
import { isFeedSortDirection, isFeedSortField } from "@/lib/feedSort";

interface FeedSortMenuProps {
  value: FeedSortPreference;
  onChange: (value: FeedSortPreference) => void;
  labelNamespace: "reader" | "settings";
  align?: "start" | "center" | "end";
  buttonClassName?: string;
}

const SORT_OPTIONS: Array<{
  field: FeedSortField;
  direction: FeedSortDirection;
  labelKey: string;
}> = [
  { field: "title", direction: "asc", labelKey: "feedSortTitleAsc" },
  { field: "title", direction: "desc", labelKey: "feedSortTitleDesc" },
  { field: "created_at", direction: "asc", labelKey: "feedSortCreatedAsc" },
  { field: "created_at", direction: "desc", labelKey: "feedSortCreatedDesc" },
];

export function FeedSortMenu({
  value,
  onChange,
  labelNamespace,
  align = "end",
  buttonClassName,
}: FeedSortMenuProps) {
  const { t } = useTranslation(labelNamespace);
  const currentValue = formatSortValue(value.field, value.direction);

  function handleValueChange(nextValue: string) {
    const parsed = parseSortValue(nextValue);
    if (!parsed) return;
    onChange(parsed);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={buttonClassName}
          title={t("feedSort")}
          aria-label={t("feedSort")}
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuLabel>{t("feedSort")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={currentValue} onValueChange={handleValueChange}>
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={formatSortValue(option.field, option.direction)}
              value={formatSortValue(option.field, option.direction)}
            >
              {t(option.labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatSortValue(field: FeedSortField, direction: FeedSortDirection): string {
  return `${field}:${direction}`;
}

function parseSortValue(value: string): FeedSortPreference | null {
  const [field, direction, extra] = value.split(":");
  if (extra !== undefined || !field || !direction) return null;
  if (!isFeedSortField(field) || !isFeedSortDirection(direction)) return null;
  return { field, direction };
}

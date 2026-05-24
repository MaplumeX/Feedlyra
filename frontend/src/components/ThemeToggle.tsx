import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

const THEME_CYCLE = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation("reader");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function cycleTheme() {
    const current = theme ?? "system";
    const currentIdx = THEME_CYCLE.indexOf(current as typeof THEME_CYCLE[number]);
    const nextIdx = (currentIdx + 1) % THEME_CYCLE.length;
    setTheme(THEME_CYCLE[nextIdx] ?? "system");
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const icon =
    theme === "dark" ? (
      <Moon className="h-4 w-4" />
    ) : theme === "light" ? (
      <Sun className="h-4 w-4" />
    ) : (
      <Monitor className="h-4 w-4" />
    );

  const label =
    theme === "dark"
      ? t("darkMode")
      : theme === "light"
        ? t("lightMode")
        : t("systemTheme");

  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cycleTheme} title={label}>
      {icon}
    </Button>
  );
}

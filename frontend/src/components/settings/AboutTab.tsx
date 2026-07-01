import { useTranslation } from "react-i18next";
import { Github } from "lucide-react";

const REPO_URL = "https://github.com/MaplumeX/Feedlyra";

export function AboutTab() {
  const { t } = useTranslation("settings");

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5 text-center">
        <h3 className="text-lg font-semibold font-heading">Feedlyra</h3>
        <p className="text-sm text-muted-foreground">{t("about.description")}</p>
      </div>
      <div className="flex items-center justify-center">
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          v{__APP_VERSION__}
        </span>
      </div>
      <div className="flex items-center justify-center">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Github className="h-3.5 w-3.5" />
          {t("about.repository")}
        </a>
      </div>
    </div>
  );
}

import { Type, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReaderStore, DEFAULT_READER_SETTINGS } from "@/stores/reader";
import { cn } from "@/lib/utils";

const FONT_OPTIONS = [
  { labelKey: "fontSystem", value: "system", stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { labelKey: "fontSongti", value: "songti", stack: "'Noto Serif SC', 'Source Han Serif SC', 'STSong', serif" },
  { labelKey: "fontHeiti", value: "heiti", stack: "'Noto Sans SC', 'Source Han Sans SC', 'STHeiti', sans-serif" },
  { labelKey: "fontKaiti", value: "kaiti", stack: "'STKaiti', 'KaiTi', serif" },
  { labelKey: "fontGeorgia", value: "georgia", stack: "Georgia, 'Noto Serif', serif" },
  { labelKey: "fontMerriweather", value: "merriweather", stack: "'Merriweather', Georgia, serif" },
  { labelKey: "fontOnest", value: "onest", stack: "'Onest', -apple-system, sans-serif" },
];

export function getFontStack(fontFamily: string): string {
  const option = FONT_OPTIONS.find((o) => o.value === fontFamily);
  return option?.stack ?? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
}

function SettingRow({ label, value, children }: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

export function ReadingSettingsPopover() {
  const { t } = useTranslation("reader");
  const { readerSettings, setReaderSetting, resetReaderSettings } = useReaderStore();
  const isDefault =
    readerSettings.fontSize === DEFAULT_READER_SETTINGS.fontSize &&
    readerSettings.fontFamily === DEFAULT_READER_SETTINGS.fontFamily &&
    readerSettings.lineHeight === DEFAULT_READER_SETTINGS.lineHeight &&
    readerSettings.contentWidth === DEFAULT_READER_SETTINGS.contentWidth &&
    readerSettings.letterSpacing === DEFAULT_READER_SETTINGS.letterSpacing &&
    readerSettings.paragraphSpacing === DEFAULT_READER_SETTINGS.paragraphSpacing;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title={t("readingSettings")}>
          <Type className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 p-3">
        <SettingRow label={t("fontSize")} value={`${readerSettings.fontSize}px`}>
          <Slider
            min={14}
            max={24}
            step={1}
            value={[readerSettings.fontSize]}
            onValueChange={(values) => setReaderSetting("fontSize", values[0] ?? readerSettings.fontSize)}
          />
        </SettingRow>

        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">{t("fontFamily")}</span>
          <Select
            value={readerSettings.fontFamily}
            onValueChange={(v) => setReaderSetting("fontFamily", v)}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} style={{ fontFamily: opt.stack }}>
                  {t(opt.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SettingRow label={t("lineHeight")} value={`${readerSettings.lineHeight}`}>
          <Slider
            min={1.4}
            max={2.2}
            step={0.05}
            value={[readerSettings.lineHeight]}
            onValueChange={(values) => setReaderSetting("lineHeight", values[0] ?? readerSettings.lineHeight)}
          />
        </SettingRow>

        <SettingRow label={t("contentWidth")} value={`${readerSettings.contentWidth}px`}>
          <Slider
            min={640}
            max={960}
            step={16}
            value={[readerSettings.contentWidth]}
            onValueChange={(values) => setReaderSetting("contentWidth", values[0] ?? readerSettings.contentWidth)}
          />
        </SettingRow>

        <SettingRow label={t("letterSpacing")} value={`${readerSettings.letterSpacing}em`}>
          <Slider
            min={0}
            max={0.1}
            step={0.01}
            value={[readerSettings.letterSpacing]}
            onValueChange={(values) => setReaderSetting("letterSpacing", values[0] ?? readerSettings.letterSpacing)}
          />
        </SettingRow>

        <SettingRow label={t("paragraphSpacing")} value={`${readerSettings.paragraphSpacing}em`}>
          <Slider
            min={0.5}
            max={2}
            step={0.05}
            value={[readerSettings.paragraphSpacing]}
            onValueChange={(values) => setReaderSetting("paragraphSpacing", values[0] ?? readerSettings.paragraphSpacing)}
          />
        </SettingRow>

        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 w-full text-xs", isDefault && "opacity-40")}
          disabled={isDefault}
          onClick={resetReaderSettings}
        >
          <RotateCcw className="mr-1.5 h-3 w-3" />
          {t("resetToDefault")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

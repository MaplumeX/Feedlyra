export type ColorScheme = "indigo" | "amber" | "forest";

export interface ColorSchemeOption {
  value: ColorScheme;
  swatch: string;
  labelKey: string;
}

export const DEFAULT_COLOR_SCHEME: ColorScheme = "indigo";

export const COLOR_SCHEMES: ColorSchemeOption[] = [
  { value: "indigo", swatch: "hsl(239 84% 58%)", labelKey: "themeIndigo" },
  { value: "amber", swatch: "hsl(28 90% 51%)", labelKey: "themeAmber" },
  { value: "forest", swatch: "hsl(152 56% 36%)", labelKey: "themeForest" },
];

export const COLOR_SCHEME_STORAGE_KEY = "feedlyra-color-scheme";

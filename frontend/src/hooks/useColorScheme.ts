import { useCallback, useEffect, useState } from "react";
import {
  COLOR_SCHEMES,
  COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_COLOR_SCHEME,
  type ColorScheme,
} from "@/lib/colorScheme";

function applySchemeClass(scheme: ColorScheme) {
  const root = document.documentElement;
  root.classList.remove(
    ...COLOR_SCHEMES.map((s) => `theme-${s.value}`)
  );
  root.classList.add(`theme-${scheme}`);
}

export function getStoredColorScheme(): ColorScheme {
  if (typeof window === "undefined") return DEFAULT_COLOR_SCHEME;
  const stored = window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
  if (stored && COLOR_SCHEMES.some((s) => s.value === stored)) {
    return stored as ColorScheme;
  }
  return DEFAULT_COLOR_SCHEME;
}

export function useColorScheme() {
  const [scheme, setSchemeState] = useState<ColorScheme>(DEFAULT_COLOR_SCHEME);

  useEffect(() => {
    const stored = getStoredColorScheme();
    setSchemeState(stored);
    applySchemeClass(stored);
  }, []);

  const setScheme = useCallback((next: ColorScheme) => {
    setSchemeState(next);
    applySchemeClass(next);
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, next);
  }, []);

  return { scheme, setScheme };
}

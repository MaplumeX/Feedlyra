import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { setupZodI18n } from "@/lib/i18n-zod";

import enCommon from "./locales/en/common.json";
import enAuth from "./locales/en/auth.json";
import enReader from "./locales/en/reader.json";
import enSettings from "./locales/en/settings.json";
import zhCommon from "./locales/zh-CN/common.json";
import zhAuth from "./locales/zh-CN/auth.json";
import zhReader from "./locales/zh-CN/reader.json";
import zhSettings from "./locales/zh-CN/settings.json";

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        reader: enReader,
        settings: enSettings,
      },
      "zh-CN": {
        common: zhCommon,
        auth: zhAuth,
        reader: zhReader,
        settings: zhSettings,
      },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "zh-CN"],
    ns: ["common", "auth", "reader", "settings", "zod"],
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
  });

// Register zod error map after i18next is initialized
setupZodI18n();

export default i18next;

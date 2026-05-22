import { z } from "zod";
import { makeZodI18nMap } from "zod-i18n-map";
import enZod from "zod-i18n-map/locales/en/zod.json";
import zhZod from "zod-i18n-map/locales/zh-CN/zod.json";
import i18next from "i18next";

// Register zod locale resources with the main i18next instance
// (called after i18next init in i18n/index.ts)
export function setupZodI18n() {
  i18next.addResourceBundle("en", "zod", enZod);
  i18next.addResourceBundle("zh-CN", "zod", zhZod);
  z.setErrorMap(makeZodI18nMap({ ns: ["zod", "auth", "common"] }));
}

export { z };

import { DOMAIN_TEXT, pickLocale, type Locale } from "@housing-compass/core";
import { getLocales } from "expo-localization";
import { create } from "zustand";
import { STRINGS, type StringKey } from "./strings";

function deviceLocale(): Locale {
  try {
    return pickLocale(getLocales().map((l) => l.languageTag));
  } catch {
    return "en";
  }
}

export const useLocale = create<{ locale: Locale; setLocale(l: Locale): void }>((set) => ({ locale: deviceLocale(), setLocale: (locale) => set({ locale }) }));

export function translate(locale: Locale, key: StringKey, vars: Record<string, string | number> = {}): string {
  const s: string = STRINGS[locale][key] ?? STRINGS.en[key];
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

/** Hook: t("explore.count", { n: 3 }) and d (domain labels: categories, trust levels, price basis). */
export function useT() {
  const locale = useLocale((s) => s.locale);
  return { t: (key: StringKey, vars?: Record<string, string | number>) => translate(locale, key, vars), d: DOMAIN_TEXT[locale], locale };
}

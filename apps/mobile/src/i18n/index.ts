import AsyncStorage from "@react-native-async-storage/async-storage";
import { DOMAIN_TEXT, LOCALES, pickLocale, type Locale } from "@housing-compass/core";
import { getLocales } from "expo-localization";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { STRINGS, type StringKey } from "./strings";

function deviceLocale(): Locale {
  try {
    return pickLocale(getLocales().map((l) => l.languageTag));
  } catch {
    return "en";
  }
}

/** The device language is the default; a language picked in Help is remembered on this device. */
export const useLocale = create<{ locale: Locale; setLocale(l: Locale): void }>()(
  persist((set) => ({ locale: deviceLocale(), setLocale: (locale) => set({ locale }) }), {
    name: "housing-compass-locale-v1",
    storage: createJSONStorage(() => AsyncStorage),
    merge: (p, cur) => {
      const loc = (p as { locale?: string } | undefined)?.locale;
      return { ...cur, locale: (LOCALES as readonly string[]).includes(loc ?? "") ? (loc as Locale) : cur.locale };
    },
  }),
);

export type TVars = Record<string, string | number>;
export type TFn = (key: StringKey, vars?: TVars) => string;

export function translate(locale: Locale, key: StringKey, vars: TVars = {}): string {
  const s: string = (STRINGS[locale] as Record<string, string>)[key] ?? STRINGS.en[key];
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

/** Hook: t("explore.count", { n: 3 }) and d (domain labels: categories, trust levels, price basis). */
export function useT(): { t: TFn; d: (typeof DOMAIN_TEXT)[Locale]; locale: Locale } {
  const locale = useLocale((s) => s.locale);
  return { t: (key, vars) => translate(locale, key, vars), d: DOMAIN_TEXT[locale], locale };
}

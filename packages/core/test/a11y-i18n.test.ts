import { describe, expect, it } from "vitest";
import { CATEGORIES, DOMAIN_TEXT, LOCALES, PRICE_BASES, VERIFICATION_LEVELS, contrastRatio, pickLocale } from "../src/index";
import { color, levelTone } from "../../../apps/mobile/src/theme";
import { STRINGS } from "../../../apps/mobile/src/i18n/strings";

describe("color contrast (WCAG AA 4.5:1 for text)", () => {
  const pairs: Array<[string, string, string]> = [
    ["ink on bg", color.ink, color.bg],
    ["sub on surface", color.sub, color.surface],
    ["muted on surface", color.muted, color.surface],
    ["muted on bg", color.muted, color.bg],
    ["white on brand", "#FFFFFF", color.brand],
    ["warn on warnSoft", color.warn, color.warnSoft],
    ["demo on demoSoft", color.demo, color.demoSoft],
    ["white on demo", "#FFFFFF", color.demo],
    ["danger on dangerSoft", color.danger, color.dangerSoft],
    ["official on officialSoft", color.official, color.officialSoft],
  ];
  for (const [name, fg, bg] of pairs) it(name, () => expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5));
  it("every trust badge is readable", () => {
    for (const lvl of VERIFICATION_LEVELS) expect(contrastRatio(levelTone[lvl].fg, levelTone[lvl].bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("translations are complete", () => {
  it("UI strings: every English key exists in every locale with the same placeholders", () => {
    for (const loc of LOCALES) {
      for (const [k, v] of Object.entries(STRINGS.en)) {
        const tr = (STRINGS[loc] as Record<string, string>)[k];
        expect(tr, `${loc}:${k}`).toBeTruthy();
        expect([...tr!.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(), `${loc}:${k}`).toEqual([...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort());
      }
    }
  });
  it("domain text covers every category, level and basis", () => {
    for (const loc of LOCALES) {
      for (const c of CATEGORIES) expect(DOMAIN_TEXT[loc].category[c]).toBeTruthy();
      for (const l of VERIFICATION_LEVELS) expect(DOMAIN_TEXT[loc].levelExplainer[l]).toBeTruthy();
      for (const b of PRICE_BASES) expect(DOMAIN_TEXT[loc].basisSuffix[b]).toBeTruthy();
    }
  });
  it("Spanish trust copy keeps the 'not fraud' and 'never send money' safeguards", () => {
    expect(DOMAIN_TEXT.es.levelExplainer.FLAGGED).toMatch(/no significa que el anuncio sea fraudulento/);
    expect(DOMAIN_TEXT.es.levelExplainer.SOURCE_LISTED_UNVERIFIED).toMatch(/Nunca envíes dinero/);
  });
  it("picks a supported locale", () => {
    expect(pickLocale(["es-MX", "en-US"])).toBe("es");
    expect(pickLocale(["vi-VN"])).toBe("en");
  });
});

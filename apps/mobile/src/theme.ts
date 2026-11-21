import type { VerificationLevel } from "@housing-compass/core";

export const color = {
  ink: "#13202F",
  sub: "#45525F",
  muted: "#5A6572",
  bg: "#F6F4EF",
  surface: "#FFFFFF",
  line: "#E3DED4",
  brand: "#0B6E5F",
  brandInk: "#FFFFFF",
  brandSoft: "#E2F1EC",
  official: "#1D4BB0",
  officialSoft: "#E7EDFB",
  verified: "#0B6E5F",
  verifiedSoft: "#E2F1EC",
  warn: "#8A4F00",
  warnSoft: "#FFF3D6",
  warnLine: "#E9B949",
  danger: "#A3241B",
  dangerSoft: "#FCEBE9",
  demo: "#6A3FA0",
  demoSoft: "#F1EAFB",
  neutralSoft: "#EEEBE5",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const type = {
  title: { fontSize: 26, fontWeight: "800" as const, color: color.ink, letterSpacing: -0.4 },
  h2: { fontSize: 19, fontWeight: "700" as const, color: color.ink },
  h3: { fontSize: 16, fontWeight: "700" as const, color: color.ink },
  body: { fontSize: 15, color: color.ink, lineHeight: 21 },
  small: { fontSize: 13, color: color.sub, lineHeight: 18 },
  tiny: { fontSize: 12, color: color.muted, lineHeight: 16 },
  price: { fontSize: 22, fontWeight: "800" as const, color: color.ink, letterSpacing: -0.3 },
} as const;

/** Minimum touch target (WCAG 2.5.5 / Apple HIG). */
export const HIT = 44;

export const levelTone: Record<VerificationLevel, { fg: string; bg: string; border: string; icon: string }> = {
  OFFICIAL_PORTAL: { fg: color.official, bg: color.officialSoft, border: color.official, icon: "shield-checkmark" },
  PROPERTY_MANAGER_VERIFIED: { fg: color.verified, bg: color.verifiedSoft, border: color.verified, icon: "checkmark-circle" },
  SOURCE_LISTED_UNVERIFIED: { fg: color.warn, bg: color.warnSoft, border: color.warnLine, icon: "alert-circle" },
  FLAGGED: { fg: color.danger, bg: color.dangerSoft, border: color.danger, icon: "hand-left" },
  EXPIRED: { fg: color.muted, bg: color.neutralSoft, border: color.line, icon: "time" },
};

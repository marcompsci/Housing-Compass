/**
 * Translations for trust-critical domain text (labels that MUST read the same everywhere).
 * Spanish was written in-house and needs a native-speaker review before launch — see docs/I18N.md.
 */
import type { Category, PriceBasis, VerificationLevel } from "./schema";
import { CATEGORY_HELP, CATEGORY_LABEL } from "./categories";
import { BASIS_LABEL, BASIS_SUFFIX } from "./pricing";
import { LEVEL_EXPLAINER, LEVEL_LABEL } from "./trust/verification";

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export interface DomainText {
  category: Record<Category, string>;
  categoryHelp: Record<Category, string>;
  level: Record<VerificationLevel, string>;
  levelExplainer: Record<VerificationLevel, string>;
  basis: Record<PriceBasis, string>;
  basisSuffix: Record<PriceBasis, string>;
}

const en: DomainText = { category: CATEGORY_LABEL, categoryHelp: CATEGORY_HELP, level: LEVEL_LABEL, levelExplainer: LEVEL_EXPLAINER, basis: BASIS_LABEL, basisSuffix: BASIS_SUFFIX };

const es: DomainText = {
  category: {
    PRIVATE_ROOM: "Cuarto privado",
    SHARED_COLIVING: "Compartido / Co-living",
    STUDIO: "Estudio",
    ENTIRE_1BR: "Apartamento 1 recámara",
    INCOME_RESTRICTED: "Con límite de ingresos",
  },
  categoryHelp: {
    PRIVATE_ROOM: "Tu propio cuarto en una casa compartida. Precio por cuarto.",
    SHARED_COLIVING: "Una cama en un cuarto compartido, vivienda estudiantil o co-living. A menudo el precio es por cama.",
    STUDIO: "Un estudio completo solo para ti.",
    ENTIRE_1BR: "Un apartamento completo de una recámara solo para ti — nunca un cuarto ni una cama.",
    INCOME_RESTRICTED: "Viviendas por debajo del precio de mercado con límites de ingresos, sorteos o listas de espera.",
  },
  level: {
    OFFICIAL_PORTAL: "Portal oficial",
    PROPERTY_MANAGER_VERIFIED: "Verificado con el administrador",
    SOURCE_LISTED_UNVERIFIED: "Pista sin verificar",
    FLAGGED: "En revisión",
    EXPIRED: "Vencido — necesita revisión",
  },
  levelExplainer: {
    OFFICIAL_PORTAL: "Publicado en un portal oficial de vivienda del gobierno. No garantiza que te acepten ni que haya una vacante inmediata.",
    PROPERTY_MANAGER_VERIFIED:
      "Nuestro revisor revisó documentos y contactó al administrador por su cuenta para confirmar que puede rentar, la dirección, la disponibilidad, la renta, el medio de contacto y las cuotas. Ningún anuncio puede garantizarse libre de estafas.",
    SOURCE_LISTED_UNVERIFIED:
      "Anunciado en otro sitio web. Nadie ha confirmado que sea real, que esté disponible ni que tenga el precio mostrado. Nunca envíes dinero antes de visitar y confirmar quién puede rentarlo.",
    FLAGGED: "Oculto temporalmente mientras una persona lo revisa. Esto no significa que el anuncio sea fraudulento.",
    EXPIRED: "No se ha revisado recientemente, así que está oculto hasta que se verifique de nuevo.",
  },
  basis: { PER_BED: "por cama", PER_ROOM: "por cuarto", PER_UNIT: "unidad completa" },
  basisSuffix: { PER_BED: "/ cama / mes", PER_ROOM: "/ cuarto / mes", PER_UNIT: "/ unidad / mes" },
};

export const DOMAIN_TEXT: Record<Locale, DomainText> = { en, es };

export function pickLocale(tags: readonly string[]): Locale {
  for (const t of tags) {
    const base = t.toLowerCase().split(/[-_]/)[0] as Locale;
    if ((LOCALES as readonly string[]).includes(base)) return base;
  }
  return "en";
}

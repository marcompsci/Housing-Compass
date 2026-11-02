/**
 * Translations for trust-critical domain text (labels that MUST read the same everywhere).
 * Spanish and Simplified Chinese were written in-house and need a native-speaker review before launch — see docs/I18N.md.
 */
import type { Category, PriceBasis, VerificationLevel } from "./schema";
import { CATEGORY_HELP, CATEGORY_LABEL } from "./categories";
import { BASIS_LABEL, BASIS_SUFFIX } from "./pricing";
import { LEVEL_EXPLAINER, LEVEL_LABEL } from "./trust/verification";

export const LOCALES = ["en", "es", "zh"] as const;
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

const zh: DomainText = {
  category: {
    PRIVATE_ROOM: "独立房间",
    SHARED_COLIVING: "合租 / 共居",
    STUDIO: "开间公寓",
    ENTIRE_1BR: "整套一居室",
    INCOME_RESTRICTED: "限收入住房",
  },
  categoryHelp: {
    PRIVATE_ROOM: "合租房屋中属于你自己的房间。按房间计价。",
    SHARED_COLIVING: "合住房间中的一个床位、学生公寓或共居空间。通常按床位计价。",
    STUDIO: "你独自使用的整套开间公寓。",
    ENTIRE_1BR: "你独自使用的整套一居室公寓——绝不是一个房间或一个床位。",
    INCOME_RESTRICTED: "低于市场价、有收入上限的住房，通常通过抽签或候补名单申请。",
  },
  level: {
    OFFICIAL_PORTAL: "官方平台",
    PROPERTY_MANAGER_VERIFIED: "已与物业经理核实",
    SOURCE_LISTED_UNVERIFIED: "未核实线索",
    FLAGGED: "审核中",
    EXPIRED: "已过期——需重新核实",
  },
  levelExplainer: {
    OFFICIAL_PORTAL: "发布在政府官方住房平台上。不保证你会被录取，也不保证立即有空房。",
    PROPERTY_MANAGER_VERIFIED:
      "我们的审核员查看了文件，并通过自己找到的联系方式联系物业经理，确认其有权出租、地址、空房情况、租金、联系渠道和各项费用。任何房源都无法保证完全没有诈骗。",
    SOURCE_LISTED_UNVERIFIED: "发布在其他网站上。没有人确认它是真实的、仍可出租或价格如所示。在看房并确认谁有权出租之前，绝不要付钱。",
    FLAGGED: "在人工审核期间暂时隐藏。这并不表示该房源是诈骗。",
    EXPIRED: "近期未经核实，因此在重新核实前隐藏。",
  },
  basis: { PER_BED: "按床位", PER_ROOM: "按房间", PER_UNIT: "整套" },
  basisSuffix: { PER_BED: "/ 床位 / 月", PER_ROOM: "/ 房间 / 月", PER_UNIT: "/ 整套 / 月" },
};

export const DOMAIN_TEXT: Record<Locale, DomainText> = { en, es, zh };

export const LOCALE_NAME: Record<Locale, string> = { en: "English", es: "Español", zh: "简体中文" };

export function pickLocale(tags: readonly string[]): Locale {
  for (const t of tags) {
    const base = t.toLowerCase().split(/[-_]/)[0] as Locale;
    if ((LOCALES as readonly string[]).includes(base)) return base;
  }
  return "en";
}

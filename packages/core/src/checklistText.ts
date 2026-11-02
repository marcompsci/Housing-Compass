/**
 * Spanish and Simplified Chinese text for the application and tour-day checklists
 * (written in-house; pending native-speaker review — see docs/I18N.md).
 */
import type { ChecklistEntry } from "./checklists";
import type { Locale } from "./i18n";
import type { MessageWarning } from "./trust/message";

type T = Record<string, { label: string; detail?: string }>;

const es: T = {
  photo_id: { label: "Identificación oficial con foto", detail: "Licencia de manejo, identificación estatal o pasaporte." },
  income: { label: "Comprobante de ingresos", detail: "Talones de pago recientes, carta de beneficios o carta de oferta de empleo. Si trabajas por tu cuenta: estados de cuenta recientes o declaración de impuestos." },
  rental_history: { label: "Historial de renta", detail: "Direcciones anteriores, fechas y contactos de arrendadores de los últimos 2–3 años." },
  references: { label: "Referencias", detail: "Una o dos personas que aceptaron ser contactadas (empleador, arrendador anterior, trabajador social)." },
  screening_report: { label: "Un reporte de evaluación o de crédito reciente (opcional)", detail: "Algunos arrendadores aceptan un reporte que ya tienes, lo que puede ahorrarte una cuota. Pregunta antes de pagar uno nuevo." },
  privacy: { label: "Envía documentos solo por la solicitud oficial", detail: "Nunca envíes por texto o correo tu SSN, fotos de identificación ni la contraseña de tu banco a alguien que no hayas verificado. Tapa los números de cuenta excepto los últimos 4 dígitos." },
  household_income: { label: "Documentos de ingresos de cada adulto del hogar", detail: "Los programas suelen contar a todas las personas de 18 años o más que vivirán ahí." },
  household_list: { label: "Nombres y fechas de nacimiento de todas las personas del hogar", detail: "El tamaño del hogar define tu límite de ingresos." },
  tax_return: { label: "Declaración de impuestos más reciente o constancia de no declarar", detail: "Muchos programas de vivienda asequible la piden." },
  assets: { label: "Estados de cuenta recientes (2–3 meses)", detail: "Se usan para confirmar bienes; tapa los números de cuenta excepto los últimos 4 dígitos." },
  confirmation: { label: "Guarda tu número de confirmación del sorteo o la lista de espera", detail: "Escríbelo en las notas de tu solicitud." },
  voucher: { label: "Documentos del vale de vivienda", detail: "Tu vale y los formularios de solicitud de arrendamiento de la autoridad de vivienda, además del contacto de tu trabajador social." },
  income_multiple: { label: "Demuestra ingresos de aproximadamente {n}× la renta", detail: "Si te falta, pregunta si cuenta un aval o el ingreso de un vale." },
  address: { label: "La dirección y la unidad coinciden con el anuncio", detail: "Compara el número del edificio, la unidad y las fotos." },
  access: { label: "La persona puede abrir la unidad y mostrarte el interior", detail: "“Estoy fuera de la ciudad, pasa y mira por la ventana” es una estafa clásica." },
  identity: { label: "Confirmaste para quién trabaja", detail: "Llama a la administradora con un número de su sitio web oficial, no el del anuncio." },
  costs: { label: "Tienes el costo total por escrito", detail: "Renta, cada cuota mensual, depósito, cuota de solicitud y total para mudarte." },
  basis: { label: "Sabes exactamente qué incluye el precio", detail: "¿Una unidad completa, un cuarto privado o una cama en un cuarto compartido?" },
  lease: { label: "Leíste el contrato antes de firmar", detail: "Duración, quién paga los servicios, reglas de visitas y mascotas, y cómo se devuelve el depósito." },
  condition: { label: "El agua, la calefacción, las ventanas, las cerraduras y los detectores de humo funcionan", detail: "Toma fotos con fecha de cualquier daño antes de mudarte." },
  no_pay: { label: "Todavía no has pagado nada", detail: "Nunca pagues un depósito ni una cuota por transferencia, tarjeta de regalo, criptomonedas o app de pagos antes de ver la vivienda y firmar." },
  buddy: { label: "Alguien sabe dónde estás", detail: "Ve con alguien o comparte tu ubicación durante la visita." },
};

const zh: T = {
  photo_id: { label: "带照片的政府身份证件", detail: "驾照、州身份证或护照。" },
  income: { label: "收入证明", detail: "近期工资单、福利发放通知或录用通知书。自雇者：近期银行对账单或报税表。" },
  rental_history: { label: "租房记录", detail: "过去 2–3 年的住址、日期和房东联系方式。" },
  references: { label: "推荐人", detail: "一到两位同意被联系的人（雇主、以前的房东、社工）。" },
  screening_report: { label: "近期的审查或信用报告（可选）", detail: "有些房东接受你已有的报告，可以省下一笔费用。在为新报告付钱之前先问清楚。" },
  privacy: { label: "只通过官方申请提交文件", detail: "绝不要通过短信或邮件把你的 SSN、身份证件照片或银行登录信息发给未经核实的人。遮住账号，只留最后 4 位。" },
  household_income: { label: "家庭中每位成年人的收入文件", detail: "项目通常会计算所有将入住的 18 岁及以上成员。" },
  household_list: { label: "所有家庭成员的姓名和出生日期", detail: "家庭人数决定你的收入上限。" },
  tax_return: { label: "最近一年的报税表或未报税声明", detail: "许多可负担住房项目会要求提供。" },
  assets: { label: "近期银行对账单（2–3 个月）", detail: "用于确认资产；遮住账号，只留最后 4 位。" },
  confirmation: { label: "保存你的抽签或候补名单确认号", detail: "把它写在申请备注里。" },
  voucher: { label: "住房券文件", detail: "你的住房券和住房管理局的租赁申请表，以及你的社工联系方式。" },
  income_multiple: { label: "证明收入约为租金的 {n} 倍", detail: "如果不够，问问担保人或住房券收入是否算数。" },
  address: { label: "地址和房号与房源一致", detail: "核对楼号、房号和照片。" },
  access: { label: "对方能打开房门并让你看室内", detail: "“我在外地，你自己去从窗户看看”是典型的诈骗。" },
  identity: { label: "你已确认对方为谁工作", detail: "用物业公司官方网站上的电话打过去确认，不要用广告里的号码。" },
  costs: { label: "你拿到了书面的全部费用", detail: "租金、每项月费、押金、申请费和入住总额。" },
  basis: { label: "你清楚价格包含什么", detail: "整套房、独立房间，还是合住房间中的一个床位？" },
  lease: { label: "签字前你读过租约", detail: "租期、谁付水电、访客和宠物规定，以及押金如何退还。" },
  condition: { label: "水、暖气、窗户、门锁和烟雾报警器都正常", detail: "入住前给任何损坏拍下带日期的照片。" },
  no_pay: { label: "你还没有付任何钱", detail: "在看房并签约之前，绝不要通过电汇、礼品卡、加密货币或支付应用支付押金或费用。" },
  buddy: { label: "有人知道你在哪里", detail: "带朋友一起去，或在看房时共享你的位置。" },
};

const TEXT: Partial<Record<Locale, T>> = { es, zh };

/** Same items, same ids and order; label/detail translated when available. */
export function localizeChecklist(items: ChecklistEntry[], locale: Locale): ChecklistEntry[] {
  const t = TEXT[locale];
  if (!t) return items;
  return items.map((it) => {
    const tr = t[it.id];
    if (!tr) return it;
    const n = it.label.match(/(\d+(?:\.\d+)?)×/)?.[1];
    return { ...it, label: n ? tr.label.replace("{n}", n) : tr.label, detail: tr.detail ?? it.detail };
  });
}

export const CHECKLIST_TRANSLATED_IDS = Object.keys(es);

// ───────── "Is this message safe?" warnings ─────────

type W = Record<MessageWarning["code"], { why: string; doThis: string }>;
const W_ES: W = {
  UPFRONT_PAYMENT: { why: "Pide dinero antes de que visites o recibas las llaves.", doThis: "No pagues. Visita primero y confirma al administrador por su sitio web oficial." },
  OFF_PLATFORM_PAYMENT: { why: "Pide el pago por {method}, que no se puede revertir.", doThis: "Paga solo a un administrador verificado, con un método rastreable y después de firmar el contrato." },
  SENSITIVE_INFO_EARLY: { why: "Pide tu número de Seguro Social o los datos de acceso de tu banco.", doThis: "No los compartas antes de una visita y una solicitud por escrito de un administrador verificado. Nunca compartas contraseñas bancarias." },
  NO_VIEWING: { why: "Dice que no puedes ver el interior antes de pagar.", doThis: "Insiste en una visita en persona o por video en vivo con quien administra la vivienda." },
  PRESSURE: { why: "Te presiona para decidir o pagar rápido.", doThis: "Ve con calma. Un administrador real te dará tiempo para revisar el contrato y su identidad." },
  MOVE_OFF_PLATFORM: { why: "Mueve la conversación a una app privada o a una cuenta personal.", doThis: "Comunícate con la propiedad usando un teléfono o correo de su sitio web oficial." },
  OVERPAYMENT_REFUND: { why: "Menciona un pago de más que debes devolver — una estafa común con cheques.", doThis: "No devuelvas dinero. Espera a que el cheque se acredite por completo en tu banco, o recházalo." },
};
const W_ZH: W = {
  UPFRONT_PAYMENT: { why: "在你看房或拿到钥匙之前就要钱。", doThis: "不要付钱。先看房，并通过官方网站确认物业经理身份。" },
  OFF_PLATFORM_PAYMENT: { why: "要求通过{method}付款，这种付款无法追回。", doThis: "只在签约后，通过可追踪的方式向已核实的物业经理付款。" },
  SENSITIVE_INFO_EARLY: { why: "索要你的社会安全号码或银行登录信息。", doThis: "在看房并通过已核实物业经理提交书面申请之前，不要提供这些信息。绝不要透露银行密码。" },
  NO_VIEWING: { why: "说你付钱前不能看室内。", doThis: "坚持与房屋管理者进行现场看房或实时视频看房。" },
  PRESSURE: { why: "催促你尽快决定或付款。", doThis: "放慢节奏。真正的物业经理会给你时间核查租约和他们的身份。" },
  MOVE_OFF_PLATFORM: { why: "把对话转到私人应用或个人账号。", doThis: "用物业官方网站上的电话或邮箱联系对方。" },
  OVERPAYMENT_REFUND: { why: "提到多付了钱要你退回——这是常见的支票诈骗。", doThis: "不要退钱。等支票在银行完全结清，或直接拒收。" },
};

export function localizeWarning(w: MessageWarning, locale: Locale): MessageWarning {
  const t = locale === "es" ? W_ES : locale === "zh" ? W_ZH : null;
  if (!t) return w;
  const method = w.why.match(/payment by (.+?), which/)?.[1] ?? "";
  return { ...w, why: t[w.code].why.replace("{method}", method), doThis: t[w.code].doThis };
}

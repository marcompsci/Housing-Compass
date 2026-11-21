/**
 * "Is this message safe?" — checks a message a renter RECEIVED from a landlord/agent.
 * Pattern-based and explainable: every warning says what it matched and why it matters.
 * It never says the sender is a scammer; it says what to do next.
 */
import { detectOffPlatformPayment, detectUpfrontPayment } from "./fraud";

export interface MessageWarning {
  code: "UPFRONT_PAYMENT" | "OFF_PLATFORM_PAYMENT" | "SENSITIVE_INFO_EARLY" | "NO_VIEWING" | "PRESSURE" | "MOVE_OFF_PLATFORM" | "OVERPAYMENT_REFUND";
  severity: "high" | "medium";
  why: string;
  doThis: string;
}

const RULES: Array<{ re: RegExp; w: MessageWarning }> = [
  {
    re: /\b(ssn|social security( number)?|bank (login|password|account number)|routing number|online banking)\b/i,
    w: { code: "SENSITIVE_INFO_EARLY", severity: "high", why: "Asks for your Social Security number or bank login/details.", doThis: "Don't share these before a tour and a written application from a verified manager. Never share bank passwords." },
  },
  {
    re: /\b(can'?t|cannot|unable to|no need to)\b[^.]{0,40}\b(show|see|view|tour|visit)\b|\bdrive by\b[^.]{0,40}\b(don'?t|do not)\b[^.]{0,20}\b(go in|disturb)\b/i,
    w: { code: "NO_VIEWING", severity: "high", why: "Says you can't see the inside before paying.", doThis: "Insist on an in-person or live video tour with the person who manages the home." },
  },
  {
    re: /\b(many|lots of|other) (people|applicants|interested)\b|\b(first come|act fast|today only|right now|asap|immediately)\b/i,
    w: { code: "PRESSURE", severity: "medium", why: "Pressures you to decide or pay quickly.", doThis: "Slow down. A real manager will give you time to check the lease and their identity." },
  },
  {
    re: /\b(whatsapp|telegram|signal app|text me (only|instead)|personal email|google voice)\b/i,
    w: { code: "MOVE_OFF_PLATFORM", severity: "medium", why: "Moves the conversation to a private app or personal account.", doThis: "Contact the property using a phone number or email from its official website." },
  },
  {
    re: /\b(sent|send|paid)\b[^.]{0,30}\b(too much|extra|more than)\b[^.]{0,40}\b(refund|send back|return)\b/i,
    w: { code: "OVERPAYMENT_REFUND", severity: "high", why: "Mentions an overpayment that you should send back — a common check scam.", doThis: "Don't send money back. Wait for any check to fully clear with your bank, or refuse it." },
  },
];

export function checkReceivedMessage(text: string, now = new Date()): { warnings: MessageWarning[]; level: "looks_ok" | "be_careful" | "stop" } {
  const warnings: MessageWarning[] = [];
  if (detectUpfrontPayment(text, now).length) {
    warnings.push({ code: "UPFRONT_PAYMENT", severity: "high", why: "Asks for money before you tour or get keys.", doThis: "Don't pay. Tour first and confirm the manager through their official website." });
  }
  for (const s of detectOffPlatformPayment(text, now)) {
    warnings.push({ code: "OFF_PLATFORM_PAYMENT", severity: "high", why: `Asks for payment by ${String(s.evidence.method)}, which can't be reversed.`, doThis: "Only pay a verified manager through a traceable method after signing a lease." });
  }
  for (const r of RULES) if (r.re.test(text)) warnings.push(r.w);
  const level = warnings.some((w) => w.severity === "high") ? "stop" : warnings.length ? "be_careful" : "looks_ok";
  return { warnings, level };
}

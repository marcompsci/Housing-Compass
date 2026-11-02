import { daysSince, type Listing } from "@housing-compass/core";
import { now } from "../config";

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ago(iso: string): string {
  const d = daysSince(iso, now());
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

/** Required on every card: last verification timestamp, or an explicit "never". */
export function lastVerifiedText(l: Listing): string {
  const v = l.verification.lastVerifiedAt;
  if (v) return `Verified ${shortDate(v)} (${ago(v)})`;
  return `Never independently verified · seen ${shortDate(l.source.capturedAt)}`;
}

export function addressText(l: Listing): string {
  const unit = l.address.unit ? `, ${l.address.unit}` : "";
  return `${l.address.line1}${unit}, ${l.address.city}`;
}

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - now().getTime()) / 86_400_000);
}

/**
 * Sharing a listing. The shared text carries the trust status so a friend never receives an
 * unverified lead dressed up as a verified home. No personal data (budget, location) is included.
 */
import { formatRent } from "./pricing";
import type { Listing } from "./schema";
import { LEVEL_LABEL } from "./trust/verification";

export const APP_SCHEME = "housingcompass";

export function listingDeepLink(id: string): string {
  return `${APP_SCHEME}://listing/${encodeURIComponent(id)}`;
}

export interface ShareContent {
  title: string;
  message: string;
  url: string | null;
}

export function listingShareContent(l: Listing, opts: { webBaseUrl?: string | null } = {}): ShareContent {
  const status = l.isDemo
    ? "FICTIONAL DEMO listing — not a real home"
    : l.verification.level === "SOURCE_LISTED_UNVERIFIED"
      ? "UNVERIFIED lead — nobody has confirmed it's real or available. Never pay before a tour."
      : LEVEL_LABEL[l.verification.level];
  const source = l.isDemo ? null : (l.source.listingUrl ?? l.source.searchPageUrls[0] ?? null);
  const web = opts.webBaseUrl ? `${opts.webBaseUrl.replace(/\/$/, "")}/listing/${encodeURIComponent(l.id)}` : null;
  const lines = [`${l.title} — ${formatRent(l)}`, `${l.address.city}, ${l.address.state}`, `Status: ${status}`];
  if (source) lines.push(`Original listing: ${source}`);
  lines.push(`Open in Housing Compass: ${web ?? listingDeepLink(l.id)}`);
  return { title: l.title, message: lines.join("\n"), url: web };
}

/** Parse an incoming deep link or web URL; returns the listing id or null. */
export function parseListingLink(url: string): string | null {
  const m = url.match(/^(?:housingcompass:\/\/|https?:\/\/[^/]+\/)listing\/([^/?#]+)/i);
  if (!m) return null;
  try {
    const id = decodeURIComponent(m[1]!);
    return /^[A-Za-z0-9._:-]{1,120}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Link checker for link-out connectors and stored source URLs. HEAD first, GET fallback,
 * identifies itself honestly, one request per host per second. It only checks reachability —
 * it never reads or stores page content.
 */
export interface LinkCheck {
  url: string;
  ok: boolean;
  status: number | null;
  finalUrl: string | null;
  error: string | null;
}

type FetchLike = (url: string, init: { method: string; redirect: "follow"; headers: Record<string, string>; signal?: AbortSignal }) => Promise<{ status: number; url: string }>;

export const LINK_CHECK_UA = "HousingCompassLinkCheck/1.0 (+https://github.com/marcompsci/Housing-Compass; reachability check only)";

export async function checkLinks(urls: string[], fetchImpl: FetchLike, opts: { perHostDelayMs?: number; sleep?: (ms: number) => Promise<void> } = {}): Promise<LinkCheck[]> {
  const delay = opts.perHostDelayMs ?? 1000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const lastHit = new Map<string, number>();
  const out: LinkCheck[] = [];
  for (const url of [...new Set(urls)]) {
    let host = "";
    try {
      host = new URL(url).host;
    } catch {
      out.push({ url, ok: false, status: null, finalUrl: null, error: "invalid URL" });
      continue;
    }
    const wait = (lastHit.get(host) ?? 0) + delay - Date.now();
    if (wait > 0) await sleep(wait);
    lastHit.set(host, Date.now());
    const headers = { "user-agent": LINK_CHECK_UA };
    try {
      let r = await fetchImpl(url, { method: "HEAD", redirect: "follow", headers });
      if (r.status === 405 || r.status === 501) r = await fetchImpl(url, { method: "GET", redirect: "follow", headers });
      // 403/429 usually means bot protection: report it, never try to work around it.
      out.push({ url, ok: r.status >= 200 && r.status < 400, status: r.status, finalUrl: r.url, error: r.status === 403 || r.status === 429 ? "blocked by site (not retried)" : null });
    } catch (e) {
      out.push({ url, ok: false, status: null, finalUrl: null, error: (e as Error).message });
    }
  }
  return out;
}

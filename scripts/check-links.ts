/**
 * Checks every link-out URL builder + stored source URL for reachability.
 *   npx tsx scripts/check-links.ts
 * Reachability only (HEAD/GET status). Never reads, stores or parses page content.
 */
import { ADAPTERS, CATEGORIES, checkLinks, researchLeads } from "../packages/core/src/index";

const urls = new Set<string>();
for (const a of ADAPTERS) {
  if (a.homeUrl.startsWith("https://") && !a.homeUrl.includes(".invalid")) urls.add(a.homeUrl);
  if (a.buildSearchUrl) for (const c of CATEGORIES) for (const city of ["Oakland", "San Francisco", "San Jose"]) urls.add(a.buildSearchUrl({ city, state: "CA", category: c, maxRentDollars: 2000 }));
}
for (const l of researchLeads()) l.source.searchPageUrls.forEach((u) => urls.add(u));

const res = await checkLinks([...urls], (u, init) => fetch(u, init).then((r) => ({ status: r.status, url: r.url })));
for (const r of res) console.log(`${r.ok ? "OK  " : "FAIL"} ${r.status ?? "---"} ${r.url}${r.error ? `  (${r.error})` : ""}`);
const failed = res.filter((r) => !r.ok && !r.error?.includes("blocked"));
process.exit(failed.length ? 1 : 0);

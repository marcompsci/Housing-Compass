// End-to-end smoke test + screenshots against the exported web build.
//   npm run web:export && node scripts/e2e-screenshots.mjs
// Asserts the acceptance criteria in the browser and writes docs/screenshots/*.png
import { createServer } from "node:http";
import { readFile, stat, mkdir } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = require(require.resolve("playwright", { paths: [process.env.NODE_PATH ?? "", "/usr/lib/node_modules", "/usr/local/lib/node_modules"] }))); }

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "apps/mobile/dist");
const out = join(root, "docs/screenshots");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".ttf": "font/ttf", ".json": "application/json" };

const server = createServer(async (req, res) => {
  let p = join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname));
  try {
    if ((await stat(p)).isDirectory()) p = join(p, "index.html");
  } catch {
    p = join(dist, "index.html"); // SPA fallback
  }
  try {
    res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" });
    res.end(await readFile(p));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
};

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => failures.push(`page error: ${e.message}`));
const shot = (name, fullPage = false) => page.screenshot({ path: join(out, `${name}.png`), fullPage });
const tab = (label) => page.getByRole("button", { name: label, exact: true }).first().click();

await page.goto(base);
await page.getByText("Showing official & manager-verified homes only").waitFor();
await page.waitForTimeout(600);
await shot("01-explore-verified-default");

// Acceptance: every card shows a source label, rent basis and last-verification timestamp.
async function cardsHaveRequiredFields(label) {
  await page.waitForTimeout(300);
  // One DOM snapshot, so list virtualization can't swap cards mid-check.
  const cards = await page.$$eval('[data-testid="listing-card"]', (els) =>
    els.map((el) => {
      const q = (id) => el.querySelectorAll(`[data-testid="${id}"]`);
      return {
        source: q("source-link").length,
        verified: q("last-verified").length,
        rent: q("rent")[0]?.textContent ?? "",
        text: el.textContent ?? "",
        cost: q("cost-facts")[0]?.textContent ?? "",
        availability: q("availability").length,
      };
    }),
  );
  const bad = cards.filter(
    (c) => c.source !== 1 || c.verified !== 1 || !/\/ (bed|room|unit) \/ mo/.test(c.rent) || !/Rent basis:/.test(c.text) || !/Deposit .* Application fee .* Move-in/.test(c.cost) || c.availability !== 1,
  );
  check(cards.length > 0 && bad.length === 0, `${label}: all ${cards.length} cards show source, rent basis, last-verified, deposit/app fee/move-in and availability`);
  return cards.length;
}
await cardsHaveRequiredFields("Private Room (verified only)");
check((await page.getByText("Unverified lead", { exact: true }).count()) === 0, "default view hides unverified leads");

// Opt in to unverified leads → warning interstitial first.
await page.getByTestId("show-unverified").click();
await page.getByText("Unverified leads have not been checked by anyone").waitFor();
await shot("02-unverified-warning");
await page.getByTestId("ack-unverified").click();
await page.getByText("Unverified leads are showing").waitFor();
await tab("Entire 1BR");
await page.waitForTimeout(300);
await shot("03-entire-1br-with-unverified-leads");
const n1br = await cardsHaveRequiredFields("Entire 1BR (with leads)");
const rents = await page.getByTestId("rent").allInnerTexts();
check(rents.every((r) => r.includes("/ unit / mo")), `Entire 1BR shows only whole-unit prices (${n1br} cards)`);
check((await page.getByText("1801 Milvia St").count()) === 0, "per-bed Berkeley lead is not in Entire 1BR");

await tab("Shared / Co-living");
await page.waitForTimeout(300);
const sharedRents = await page.getByTestId("rent").allInnerTexts();
check(sharedRents.some((r) => r.includes("/ bed / mo")) && sharedRents.every((r) => !r.includes("/ unit / mo")), "Shared tab has per-bed prices and no whole-unit prices");
await shot("04-shared-coliving", true);

// Map
await tab("Entire 1BR");
await page.getByRole("tab", { name: "Map" }).click();
await page.waitForTimeout(2500);
await shot("05-map-entire-1br");
const area = page.locator(".hc-area").first();
check((await area.count()) > 0, "map shows dashed city-level areas for approximate leads");
const pin = page.locator(".hc-pin").first();
if (await pin.count()) {
  await pin.click();
  await page.waitForTimeout(400);
  await shot("06-map-selected-pin");
}
await page.getByRole("tab", { name: "List" }).click();

// Detail of an unverified lead
await page.getByText("Oak Village · 1BR advertised").first().click();
await page.getByText("What it costs").waitFor();
await page.waitForTimeout(300);
await shot("07-detail-unverified-lead", true);
check((await page.getByText("Not confirmed").count()) >= 3, "lead detail shows unknown fees as Not confirmed");
check((await page.getByText("Where this came from").count()) === 1 && (await page.getByText("Search pages this lead was found on", { exact: false }).count()) === 1, "detail shows provenance with source search pages");
await page.goBack();

// Detail of a demo verified listing
await tab("Private Room");
await page.getByText("DEMO · Sunny room in 3BR flat").first().click();
await page.getByText("What it costs").waitFor();
await shot("08-detail-demo-verified", true);
await page.goBack();

// Compare: add a room and a 1BR → must render in separate tables
await page.getByRole("button", { name: "Add to compare" }).first().click();
await tab("Entire 1BR");
await page.getByRole("button", { name: "Add to compare" }).first().click();
await page.getByRole("tab", { name: /Compare/ }).click().catch(() => page.getByText("Compare", { exact: true }).last().click());
await page.getByText("Shown in separate tables").waitFor();
await shot("09-compare-separate-bases", true);
check((await page.getByText(/^Priced (per room|entire unit)$/).count()) === 2, "compare splits per-room and entire-unit prices");

// Filters + Help
await page.goto(`${base}/filters`);
await page.getByText("Budget").first().waitFor();
await shot("10-filters", true);
await page.goto(`${base}/help`);
await page.getByText("What our labels mean").waitFor();
await shot("11-help-safety", true);
await page.goto(base);
await page.getByRole("button", { name: /Search area:/ }).click();
await page.getByText("Use my location").first().waitFor();
await shot("12-location");
await page.getByLabel("City or ZIP code").fill("94612");
await page.getByRole("button", { name: "Search here" }).click();
await page.getByText("Oakland, CA 94612").waitFor();
check(true, "ZIP 94612 resolves to Oakland");
await shot("13-explore-after-zip");

// ── Phase 7: track an application from a listing
await page.goto(base);
await tab("Private Room");
await page.getByText("DEMO · Sunny room in 3BR flat").first().click();
await page.getByRole("button", { name: "Track application" }).click();
await page.getByTestId("application-card").first().waitFor();
check((await page.getByText("Interested").count()) > 0, "tracking a listing creates an Interested application");
await page.getByRole("button", { name: "→ Applied" }).first().click();
await page.waitForTimeout(200);
check((await page.getByTestId("application-card").first().innerText()).includes("Applied"), "application moves to Applied");
await shot("14-applications");

// ── Phase 8: my numbers → affordability on a listing
await page.goto(`${base}/affordability`);
await page.getByLabel("Yearly household income in dollars").fill("52000");
await page.getByLabel("Savings available for move-in costs in dollars").fill("1500");
await shot("15-my-numbers");
await page.getByRole("button", { name: "Save on this device" }).click();
await page.goto(base);
await tab("Private Room");
await page.getByText("DEMO · Sunny room in 3BR flat").first().click();
await page.getByText("Can I afford & qualify?").waitFor();
check((await page.getByText(/% of income/).count()) > 0, "listing shows rent as a share of income");
await page.getByText("Can I afford & qualify?").scrollIntoViewIfNeeded();
await shot("16-afford-panel");

// ── Phase 10: received-message safety check
await page.goto(`${base}/check-message`);
await page.getByLabel("Message to check").fill("I'm out of the country so I can't show it. Send the deposit by gift cards today, many people want it. Text me on WhatsApp.");
await page.getByTestId("check-message").click();
await page.getByText("Stop — don't send money or personal details").waitFor();
check(true, "message checker stops a classic scam script");
await shot("17-message-check");

// ── Phase 5: reviewer queue (local demo mode) + neutral-language guard
await page.goto(`${base}/review`);
await page.getByTestId("review-item").first().waitFor();
check((await page.getByText("Demo review mode").count()) === 1, "review queue labels local demo mode");
await shot("18-review-queue");
await page.getByText("DEMO · Held for review (risk signals)").click();
await page.getByText("Six-check verification").waitFor();
await page.getByLabel("Decision reason").fill("obvious scam");
check((await page.getByText(/instead of a verdict word/).count()) === 1, "reviewer is asked to use neutral language");
await page.getByLabel("Decision reason").fill("Asked for a wire before any tour; owner could not be reached");
await shot("19-review-item");

// ── Phase 6: alerts inbox reachable from Explore
await page.goto(base);
await page.getByRole("button", { name: /^Alerts/ }).click();
await page.getByText(/Alerts are worked out on this device|No alerts yet/).first().waitFor();
check(true, "alerts inbox opens");

// ── Los Angeles expansion
await page.goto(base);
await page.getByRole("button", { name: /Search area:/ }).click();
await page.getByRole("button", { name: "Los Angeles County", exact: true }).click();
await page.getByTestId("pick-region").click();
await page.getByText("Los Angeles County").first().waitFor();
await tab("Private Room");
await page.waitForTimeout(300);
const laCards = await page.getByTestId("listing-card").allInnerTexts();
check(laCards.length > 0 && laCards.every((t) => !/San Francisco|Oakland|Berkeley/.test(t)), `LA County search shows only LA listings (${laCards.length} cards)`);
check((await page.getByTestId("unverified-section").count()) === 1, "unverified leads sit under a separate, labeled section");
await cardsHaveRequiredFields("LA rooms");
await shot("21-la-rooms");
await tab("Shared / Co-living");
await page.waitForTimeout(300);
const coRents = await page.getByTestId("rent").allInnerTexts();
check(coRents.length > 0 && coRents.every((r) => !r.includes("/ unit / mo")), "LA co-living is never priced as an entire unit");
await tab("Entire 1BR");
await page.waitForTimeout(300);
check((await page.getByText(/Above your \$1,400 preference/).count()) > 0, "LA one-bedrooms above $1,400 are labeled, not hidden or mixed in silently");
await page.getByRole("tab", { name: "Map" }).click();
await page.waitForTimeout(2000);
await shot("22-la-map");
await page.getByRole("tab", { name: "List" }).click();
await page.goto(`${base}/programs`);
await page.getByRole("button", { name: "City of Los Angeles", exact: true }).click();
await page.getByText("Affordable & Accessible Housing Registry (AAHR)").waitFor();
check((await page.getByText("Call 1-877-428-8844").count()) === 1, "LA programs show the LA County Housing Resource Center line");
check((await page.getByText("Programs are not vacancies").count()) === 1, "programs are clearly separated from vacancies");
await shot("23-la-programs");
await page.goto(`${base}/review`);
await page.getByRole("button", { name: /Research leads \(/ }).click();
await page.getByTestId("lead-item").first().waitFor();
check(/Research leads \((7[0-9]|76)\)/.test(await page.getByRole("button", { name: /Research leads/ }).innerText()), "moderators see Bay Area + LA research leads pending review");
await shot("24-lead-moderation");

// ── Messaging with masked contacts, holds and tour requests (demo listing, local mode)
await page.goto(base);
await page.getByRole("button", { name: /Search area:/ }).click();
await page.getByRole("button", { name: "San Francisco Bay Area", exact: true }).click();
await page.getByTestId("pick-region").click();
await tab("Private Room");
await page.getByText("DEMO · Sunny room in 3BR flat").first().click();
await page.getByTestId("message-manager").click();
await page.getByLabel("Message text").fill("Hi, is it available? Call me at (510) 555-0199");
check((await page.getByText(/will be hidden until a tour is confirmed/).count()) === 1, "composer previews contact masking before sending");
await page.getByTestId("send-message").click();
await page.getByText("Contact details hidden").first().waitFor();
check((await page.getByText(/555-0199/).count()) === 0, "phone number is masked in the sent message");
await page.getByLabel("Message text").fill("Can I send the deposit by gift card before the tour?");
await page.getByTestId("send-message").click();
await page.getByText(/Held for review: off-platform payment/).waitFor();
check(true, "payment-before-tour message is held for review");
await page.getByRole("button", { name: /Sat|Sun|Mon|Tue|Wed|Thu|Fri/ }).first().click();
await page.getByText(/tour · .* · proposed/).first().waitFor();
await shot("25-conversation");
await page.goto(`${base}/inquiries`);
await page.getByTestId("inquiry").first().waitFor();
check((await page.getByText("Tour requested").count()) >= 1, "inquiry tracker shows tour status");
await shot("26-inquiries");
await page.goto(`${base}/landlord`);
await page.getByText("How verification works").waitFor();
await shot("27-landlord-onboarding");
check(true, "landlord onboarding explains authority checks");

// ── Phase 9: Spanish
await page.goto(`${base}/help`);
await page.getByRole("button", { name: "Español" }).click();
await page.getByRole("tab", { name: /Explorar/ }).click().catch(() => page.getByText("Explorar").first().click());
await page.getByText(/Se muestran pistas sin verificar|Mostrando solo viviendas oficiales/).first().waitFor();
check(true, "Spanish UI and trust labels render");
await shot("20-spanish");

await browser.close();
server.close();
if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nE2E PASSED — screenshots in docs/screenshots/");

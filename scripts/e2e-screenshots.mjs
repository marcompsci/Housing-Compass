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
// Freeze the browser clock so date-based behavior (lead expiry, due dates, countdowns) is the
// same on every run. Override with E2E_NOW=<ISO date>.
const NOW = new Date(process.env.E2E_NOW ?? "2026-11-05T18:00:00.000Z");
await page.clock.setFixedTime(NOW);
page.on("pageerror", (e) => failures.push(`page error: ${e.message}`));
const shot = (name, fullPage = false) => page.screenshot({ path: join(out, `${name}.png`), fullPage });
const tab = (label) => page.getByRole("button", { name: label, exact: true }).first().click();

await page.goto(base);
// ── v0.14: first-run onboarding (3 steps, skippable), shown once
await page.getByTestId("welcome").waitFor();
check((await page.getByText("Welcome to Housing Compass").count()) === 1, "first launch shows the welcome tour");
await shot("28-welcome");
await page.getByTestId("welcome-next").click();
await page.getByText("What are you looking for?").waitFor();
check((await page.getByText(/never mixed together/).count()) === 1, "onboarding explains per-bed vs per-room vs whole-unit pricing");
await page.getByTestId("welcome-next").click();
await page.getByText("Your location stays private").waitFor();
await page.getByTestId("welcome-finish").click();
await page.getByText("Showing official & manager-verified homes only").waitFor();
await page.reload();
await page.getByText("Showing official & manager-verified homes only").waitFor();
await page.waitForTimeout(500);
check((await page.getByTestId("welcome").count()) === 0, "welcome tour is not shown again after finishing");
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
await page.getByLabel("Paste the message here").fill("I'm out of the country so I can't show it. Send the deposit by gift cards today, many people want it. Text me on WhatsApp.");
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

// ── v0.14: tour confirmed (demo) → calendar file + tour-day checklist
await page.goto(base);
await page.getByText("DEMO · Sunny room in 3BR flat").first().click();
await page.getByTestId("message-manager").click();
await page.getByText(/tour · .* · proposed/).first().waitFor();
await page.getByRole("button", { name: /Simulate manager confirming/ }).first().click();
await page.getByText(/tour · .* · confirmed/).first().waitFor();
const [ics] = await Promise.all([page.waitForEvent("download"), page.getByTestId("add-to-calendar").first().click()]);
const icsText = await readFile(await ics.path(), "utf8");
check(ics.suggestedFilename().endsWith(".ics") && icsText.includes("BEGIN:VCALENDAR") && icsText.includes("TRIGGER:-PT60M") && /never pay a deposit/i.test(icsText.replace(/\r\n /g, "")), "confirmed tour exports a valid .ics with a reminder and the safety note");
await page.getByRole("button", { name: /Tour-day checklist/ }).first().click();
await page.getByTestId("checklist-item").first().click();
check((await page.getByRole("button", { name: /Tour-day checklist \(1\// }).count()) === 1, "tour-day checklist ticks are counted");
await shot("29-tour-calendar-checklist");

// ── v0.14: reviewer tools — held messages, landlord applications, lead expiry countdown
await page.goto(`${base}/review`);
await page.getByRole("button", { name: /Held messages \(/ }).click();
await page.getByTestId("held-item").first().waitFor();
check((await page.getByText(/gift card/).count()) >= 1, "held demo message is in the reviewer queue");
await page.getByLabel("Reason for your decision").first().fill("This is a scam");
check(await page.getByRole("button", { name: "Keep hidden" }).first().isDisabled(), "held-message decisions refuse verdict language");
await page.getByLabel("Reason for your decision").first().fill("Asked for a gift-card deposit before any tour");
await page.getByRole("button", { name: "Keep hidden" }).first().click();
await page.waitForTimeout(300);
check((await page.getByText(/Held messages \(0\)/).count()) === 1, "kept-hidden message leaves the queue");
await page.getByRole("button", { name: /Landlords \(/ }).click();
await page.getByTestId("landlord-item").first().waitFor();
check(await page.getByRole("button", { name: "Approve", exact: true }).isDisabled(), "landlord approval is disabled until all four authority checks pass");
for (const box of await page.getByRole("checkbox").all()) await box.click();
for (const note of await page.getByLabel(/^Note for /).all()) await note.fill("Found on county assessor site");
await page.getByLabel("Reviewer notes").fill("Called the office number on their official site; saw management agreement");
await shot("30-landlord-review");
await page.getByRole("button", { name: "Approve", exact: true }).click();
await page.waitForTimeout(300);
check((await page.getByText(/Landlords \(0\)/).count()) === 1, "approved landlord application leaves the queue");
await page.getByRole("button", { name: /Research leads \(/ }).click();
await page.getByTestId("lead-expiry-summary").waitFor();
check((await page.getByText(/days left|Hides today|past due/).count()) > 0, "lead queue shows an expiry countdown");
await shot("31-lead-expiry");

// ── v0.14: draw-an-area search on the map
await page.goto(base);
await page.getByRole("tab", { name: "Map" }).click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Draw an area" }).click();
await page.getByTestId("draw-panel").waitFor();
const box = await page.getByTestId("map").boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
for (const [dx, dy] of [[-90, -90], [90, -90], [90, 90], [-90, 90]]) {
  await page.mouse.click(cx + dx, cy + dy);
  await page.waitForTimeout(150);
}
check((await page.getByText(/4 points/).count()) === 1, "tapping the map adds outline points");
await shot("32-draw-area");
await page.getByRole("button", { name: "Search this area" }).click();
await page.getByRole("tab", { name: "List" }).click();
await page.getByText("Drawn area").first().waitFor();
check(true, "a drawn area becomes a removable search filter");
// v0.15: save the drawn area with a name, then reuse it from the map
await page.getByRole("button", { name: "Save this area" }).click();
await page.getByTestId("area-name").fill("Near work");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.getByText("Near work").first().waitFor();
check(true, "a drawn area can be saved with a name");
await page.getByText("Near work").first().click();
await page.waitForTimeout(200);
await page.getByRole("tab", { name: "Map" }).click();
await page.waitForTimeout(800);
check((await page.getByRole("button", { name: "Near work" }).count()) === 1, "saved areas appear as one-tap chips on the map");
await page.getByRole("button", { name: "Near work" }).click();
await page.getByRole("tab", { name: "List" }).click();
await page.getByText("Near work").first().waitFor();
check(true, "a saved area can be applied again");
await shot("38-saved-area");
await page.getByText("Near work").first().click();
await page.waitForTimeout(200);
await page.getByRole("tab", { name: "Map" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Draw an area" }).click();
for (const [dx, dy] of [[-90, -90], [90, -90], [90, 90], [-90, 90]]) { await page.mouse.click(cx + dx, cy + dy); await page.waitForTimeout(120); }
await page.getByRole("button", { name: "Search this area" }).click();
await page.getByRole("tab", { name: "List" }).click();
await page.getByText("Near work").first().waitFor();
await page.getByText("Near work").first().click();
await page.waitForTimeout(200);
check((await page.getByText("Drawn area").count()) === 0, "drawn area can be cleared");

// ── v0.14: listing extras — response metrics, price history, travel, share, savings
await page.getByText("DEMO · Sunny room in 3BR flat").first().click();
await page.getByText("What it costs").waitFor();
check((await page.getByText(/Replies to 92% of messages/).count()) === 1, "demo listing shows manager response metrics (labeled demo)");
check((await page.getByText("Price history", { exact: true }).count()) === 1 && (await page.getByText("Demo listings have no price history.").count()) === 1, "price history panel never invents history for demo listings");
check((await page.getByText(/Add a commute destination in Filters/).count()) === 1, "travel panel asks for a destination instead of guessing");
check((await page.getByTestId("share-listing").count()) === 1, "listing can be shared");
await page.getByRole("button", { name: "Plan my savings for this move-in" }).click();
await page.getByTestId("savings-rate").fill("150");
await page.getByTestId("savings-result").waitFor();
check((await page.getByText(/About \d+ weeks — ready around/).count()) === 1, "move-in savings planner gives weeks and a date");
await shot("33-savings-plan");

// ── v0.14: document checklist on tracked applications
await page.goto(`${base}/applications`);
await page.getByTestId("docs-toggle").first().click();
check((await page.getByText("Send documents only through the official application").count()) >= 1, "application document checklist ends with the privacy rule");
await shot("34-application-documents");

// ── v0.14: alert settings + data export + landlord dashboard
await page.goto(`${base}/inbox`);
await page.getByTestId("alert-settings-link").click();
await page.getByTestId("alert-settings").waitFor();
await page.getByRole("switch", { name: "Application deadlines", exact: true }).click();
await page.waitForTimeout(200);
check(!(await page.getByRole("switch", { name: "Application deadlines", exact: true }).isChecked()), "alert kinds can be turned off");
await shot("35-alert-settings");
await page.goto(`${base}/account`);
const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-data").click()]);
const exported = JSON.parse(await readFile(await dl.path(), "utf8"));
check(exported.format === "housing-compass-export" && Array.isArray(exported.device.favorites) && !JSON.stringify(exported).includes("commuteTo\":{"), "data export downloads readable JSON without location");
await page.goto(`${base}/landlord-dashboard`);
await page.getByTestId("dashboard-listing").first().waitFor();
check((await page.getByText("Demo dashboard").count()) === 1, "landlord dashboard (demo) lists the manager's listings");
await shot("36-landlord-dashboard");

// ── v0.15: keyword search + total-cost sort
await page.goto(base);
await page.getByTestId("search-input").fill("Oakland");
await page.waitForTimeout(700);
const qCards = await page.getByTestId("listing-card").allInnerTexts();
check(qCards.length > 0 && qCards.every((t) => /Oakland/i.test(t)), `keyword search narrows results (${qCards.length} Oakland cards)`);
await shot("39-keyword-search");
await page.getByTestId("search-input").fill("");
await page.waitForTimeout(400);
await page.goto(`${base}/filters`);
await page.getByRole("button", { name: "Lowest total monthly" }).click();
check((await page.getByRole("button", { name: "Lowest total monthly" }).count()) === 1, "filters offer sorting by total monthly cost");

// ── v0.15: know your rights + fee checks
await page.goto(`${base}/help`);
await page.getByTestId("rights-link").click();
await page.getByTestId("rights").waitFor();
check((await page.getByText(/Security deposits: usually one month/).count()) === 1 && (await page.getByText(/Build credit with on-time rent/).count()) === 1, "rights screen covers deposits, fees and rent reporting with sources");
check((await page.getByText(/Civil Code §1950.5/).count()) >= 1, "rights cite the statute");
await shot("40-rights");

// ── v0.15: private notes on saved homes + compare rows
await page.goto(base);
await tab("Private Room");
await page.getByText("DEMO · Sunny room in 3BR flat").first().click();
await page.getByText("What it costs").waitFor();
if ((await page.getByRole("button", { name: /Saved$/ }).count()) === 0) await page.getByRole("button", { name: /Save$/ }).first().click();
await page.goto(`${base}/saved`);
await page.getByTestId("add-note").first().click();
await page.getByTestId("note-input").first().fill("Tour Sat 10am, ask about parking");
await page.reload();
await page.getByText("Saved", { exact: true }).first().waitFor();
await page.waitForTimeout(500);
check((await page.getByTestId("note-input").first().inputValue()) === "Tour Sat 10am, ask about parking", "private notes on saved homes persist");
await shot("41-saved-notes");
await page.goto(`${base}/compare`);
await page.waitForTimeout(500);
check((await page.getByText("Application fee", { exact: true }).count()) >= 1 && (await page.getByText("Cost checks", { exact: true }).count()) >= 1, "compare shows application fee and cost checks");

// ── v0.15: manager change request → reviewer approval (demo)
await page.goto(`${base}/landlord-dashboard`);
await page.getByTestId("request-change").first().click();
await page.getByTestId("edit-form").waitFor();
const dashTitle = await page.getByTestId("dashboard-listing").first().locator("text=/DEMO/").first().innerText();
await page.getByTestId("edit-rent").fill("1,111");
await page.getByTestId("send-edit").click();
check((await page.getByText(/Add a short note/).count()) === 1, "change requests need a note");
await page.getByTestId("edit-note").fill("New rent starting Dec 1");
await page.getByTestId("send-edit").click();
await page.getByText(/Sent \(demo\)/).waitFor();
check((await page.getByText("Waiting for review").count()) === 1, "manager sees the request waiting for review");
await shot("42-change-request");
await page.evaluate(() => window.history.pushState({}, "", "/review"));
await page.evaluate(() => window.dispatchEvent(new PopStateEvent("popstate")));
await page.getByRole("button", { name: /Listing edits \(1\)/ }).click();
await page.getByTestId("edit-item").waitFor();
await page.getByLabel("Reason for your decision on this change").fill("Called office: new rent confirmed");
await page.getByRole("button", { name: "Approve change" }).click();
await page.waitForTimeout(300);
check((await page.getByText(/Listing edits \(0\)/).count()) === 1, "approved change leaves the queue");
await page.evaluate(() => { window.history.pushState({}, "", "/landlord-dashboard"); window.dispatchEvent(new PopStateEvent("popstate")); });
await page.getByTestId("request-change").first().click();
await page.getByText(/Listed now: \$1,111 rent/).waitFor();
check((await page.getByText("Approved").count()) >= 1, `approved change updates the listing (“${dashTitle}” now $1,111) and shows as Approved`);

// ── v0.15: reports I sent
await page.goto(`${base}/account`);
await page.getByTestId("my-reports-link").click();
await page.getByTestId("my-reports").waitFor();
check((await page.getByText(/Saved on this device|You haven't reported any listings/).count()) >= 1, "reports screen shows each report's status");

// ── v0.16: My plan, rent tracker, move in/out, waitlists, local help, recent searches
{
  const iso = (d) => d.toISOString().slice(0, 10);
  await page.goto(`${base}/plan`);
  await page.getByTestId("plan").waitFor();
  check((await page.getByText("My plan", { exact: true }).count()) >= 1 && (await page.getByTestId("tool-rent").count()) === 1, "My plan tab lists renter tools");
  await shot("44-plan-empty");
  await page.getByTestId("tool-rent").click();
  await page.getByTestId("rent-amount").fill("1400");
  await page.getByTestId("rent-due-day").fill(String(new Date(NOW).getUTCDate()));
  await page.getByTestId("rent-save-setup").click();
  await page.getByTestId("rent-summary").waitFor();
  await page.getByTestId("pay-add").click();
  await page.getByTestId("pay-msg").waitFor();
  check((await page.getByTestId("payment-row").count()) === 1 && /Logged/.test(await page.getByTestId("pay-msg").innerText()), "rent payment logged with on-time result");
  await page.getByTestId("pay-add").click();
  check(/already logged/.test(await page.getByTestId("pay-msg").innerText()), "duplicate payment rejected");
  check((await page.getByTestId("rent-summary").getByText(/1-month on-time streak/i).count()) === 1, "on-time streak shown");
  check((await page.getByTestId("rent-export").count()) === 1, "payment history can be exported as a spreadsheet");
  await page.getByTestId("rent-reminders").click();
  check(/phone app/.test(await page.getByTestId("rent-rem-msg").innerText()), "web explains reminders run on the phone");
  await page.getByTestId("rent-summary").scrollIntoViewIfNeeded();
  await shot("45-rent-tracker");

  await page.goto(`${base}/plan`);
  await page.getByTestId("plan-item").first().waitFor();
  check((await page.getByText(/Rent due · \$1,400/).count()) === 1, "My plan shows the next rent due");

  await page.goto(`${base}/move`);
  await page.getByTestId("movein-address").fill("801 14th St, Oakland");
  await page.getByTestId("movein-start").click();
  await page.getByTestId("condition-item").first().getByRole("button", { name: "Damaged" }).click();
  await page.getByLabel("What's wrong?").fill("Deadbolt sticks");
  check((await page.getByText(/1 of \d+ items checked/).count()) === 1 && (await page.getByText("1 damaged").count()) === 1, "move-in record tracks items and damage");
  const moveOut = new Date(NOW.getTime() - 10 * 86_400_000);
  await page.getByTestId("moveout-date").fill(iso(moveOut));
  await page.getByTestId("moveout-deposit").fill("1400");
  await page.getByTestId("moveout-forwarding").fill("2 Elm St, Oakland CA 94612");
  await page.getByTestId("moveout-start").click();
  await page.getByTestId("deposit-countdown").waitFor();
  check(/1[01] days left/.test(await page.getByTestId("deposit-countdown").innerText()), "deposit return counts down 21 days from move-out");
  await shot("47-move-in-out", true);

  await page.goto(`${base}/waitlists`);
  await page.getByTestId("wl-name").fill("Oakland Housing Authority — Section 8");
  await page.getByTestId("wl-checkin").fill(iso(new Date(NOW.getTime() + 3 * 86_400_000)));
  await page.getByTestId("wl-add").click();
  await page.getByTestId("waitlist-card").waitFor();
  check((await page.getByText("Check-in due soon").count()) === 1, "waitlist flags an upcoming check-in");
  await shot("48-waitlists");

  await page.goto(`${base}/plan`);
  await page.getByTestId("plan-item").first().waitFor();
  check((await page.getByText(/Confirm your spot: Oakland Housing Authority/).count()) === 1 && (await page.getByText("Security deposit due back").count()) === 1, "My plan combines rent, deposit and waitlist dates");
  await shot("46-plan");

  await page.goto(`${base}/local-help`);
  await page.getByRole("button", { name: "Oakland", exact: true }).click();
  check((await page.getByText("Oakland Rent Adjustment Program (RAP)").count()) === 1 && (await page.getByText(/Tenant Protection Act/).count()) === 1, "local help shows the city's official office and the statewide fallback");
  await shot("49-local-help");

  await page.goto(base);
  await page.getByTestId("search-input").fill("Oakland");
  await page.getByTestId("search-input").press("Enter");
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByTestId("recent-searches").waitFor();
  check((await page.getByTestId("recent-searches").getByRole("button", { name: "Oakland", exact: true }).count()) === 1, "recent searches are offered as chips");

  await page.goto(`${base}/help`);
  await page.getByRole("button", { name: "Español" }).click();
  await page.goto(`${base}/plan`);
  await page.getByText("Mi plan", { exact: true }).waitFor();
  check((await page.getByText("Herramientas para inquilinos").count()) === 1, "My plan renders in Spanish");
  await page.goto(`${base}/help`);
  await page.getByRole("button", { name: "English" }).click();
}

// ── v0.17: bills & budget, rent increase checker, milestones, history summary, translated move-in items
{
  await page.goto(`${base}/plan`);
  await page.getByTestId("tool-bills").click();
  await page.getByTestId("bills").waitFor();
  const day = new Date(NOW).getUTCDate();
  const soonDay = ((day + 1) % 28) + 1;
  await page.getByTestId("bill-name").fill("Phone");
  await page.getByTestId("bill-amount").fill("65");
  await page.getByTestId("bill-day").fill(String(soonDay));
  await page.getByTestId("bill-add").click();
  await page.getByTestId("bill-name").fill("PG&E");
  await page.getByTestId("bill-amount").fill("90");
  await page.getByTestId("bill-day").fill("20");
  await page.getByRole("button", { name: "Paid automatically (autopay)" }).click();
  await page.getByTestId("bill-add").click();
  check((await page.getByTestId("bill-row").count()) === 2, "bills are added and listed by due date");
  await page.getByLabel("Mark Phone paid this month").click();
  check((await page.getByText("Paid", { exact: true }).count()) >= 1, "a bill can be checked off for the month");
  await page.getByLabel("Mark Phone paid this month").click();
  await page.getByTestId("take-home").fill("4000");
  await page.getByTestId("take-home-save").click();
  await page.getByTestId("budget").waitFor();
  check(/\$2,445/.test(await page.getByTestId("budget").innerText()), "budget shows what's left after rent and bills");
  check((await page.getByTestId("bills-calendar").count()) === 1, "due dates can be added to the calendar");
  await page.getByTestId("bill-row").first().scrollIntoViewIfNeeded();
  await shot("50-bills");

  await page.goto(`${base}/plan`);
  await page.getByTestId("plan-item").first().waitFor();
  check((await page.getByText(/Phone · \$65/).count()) >= 1, "My plan includes upcoming bills");

  await page.goto(`${base}/rent-increase`);
  await page.getByTestId("inc-current").fill("2000");
  await page.getByTestId("inc-new").fill("2240");
  await page.getByTestId("inc-cpi").fill("3");
  await page.getByTestId("inc-notice").fill("2026-11-01");
  await page.getByTestId("inc-effective").fill("2026-12-01");
  await page.getByTestId("inc-check").click();
  await page.getByTestId("inc-result").waitFor();
  const inc = await page.getByTestId("inc-result").innerText();
  check(/12%/.test(inc) && /above the statewide cap/.test(inc) && /less notice than the law requires/.test(inc), "rent increase checker flags an increase over the cap and short notice");
  await shot("51-rent-increase", true);

  await page.goto(`${base}/rent`);
  await page.getByTestId("milestones").waitFor();
  check((await page.getByLabel("1-month milestone reached").count()) === 1 && (await page.getByText(/2 more on-time months to reach 3 months/).count()) === 1, "on-time milestones show progress");
  check((await page.getByTestId("history-letter").count()) === 1, "rent history summary for applications");
  await page.getByTestId("milestones").scrollIntoViewIfNeeded();
  await shot("52-milestones");

  await page.goto(`${base}/help`);
  await page.getByRole("button", { name: "Español" }).click();
  await page.goto(`${base}/move`);
  await page.getByText("Puerta de entrada y cerradura").waitFor();
  check(true, "move-in checklist items are translated");
  await page.goto(`${base}/plan`);
  await page.getByText("Facturas y presupuesto").first().waitFor();
  check((await page.getByText(/Vence en \d+ días|Vence hoy/).count()) >= 1, "My plan details are translated");
  await page.goto(`${base}/help`);
  await page.getByRole("button", { name: "English" }).click();
}

// ── v0.18: money hub, quick setup, paycheck planner, bank import, debts, credit, goals, found money, split, backup
{
  const iso = (d) => d.toISOString().slice(0, 10);
  const todayIso = iso(new Date(NOW));
  await page.goto(`${base}/plan`);
  await page.getByTestId("tool-money").click();
  await page.getByTestId("money").waitFor();
  check((await page.getByTestId("setup-start").count()) === 1, "money hub offers quick setup");
  await page.getByTestId("setup-start").click();
  await page.getByTestId("setup-rent").fill("1400");
  await page.getByTestId("setup-due").fill(String(new Date(NOW).getUTCDate()));
  await page.getByTestId("setup-next-1").click();
  await page.getByRole("button", { name: "Every 2 weeks" }).click();
  await page.getByTestId("pay-amount-in").fill("1500");
  await page.getByTestId("pay-anchor").fill(iso(new Date(NOW.getTime() + 3 * 86_400_000)));
  await page.getByTestId("pay-save").click();
  await page.getByTestId("setup-bill-name").fill("Netflix");
  await page.getByTestId("setup-bill-amount").fill("15.99");
  await page.getByTestId("setup-bill-day").fill("25");
  await page.getByTestId("setup-bill-add").click();
  await page.getByTestId("setup-done").click();
  await page.getByTestId("money-snapshot").waitFor();
  check(/Set aside \$/.test(await page.getByTestId("money-snapshot").innerText()), "quick setup fills the money snapshot");
  await shot("53-money");

  await page.getByTestId("tool-paycheck").click();
  await page.getByTestId("pay-bucket").first().waitFor();
  check((await page.getByTestId("pay-bucket").count()) >= 3, "paycheck planner shows upcoming checks");
  await page.getByTestId("start-balance").fill("200");
  await page.getByTestId("forecast-btn").click();
  await page.getByTestId("forecast").waitFor();
  check(/Lowest balance ahead/.test(await page.getByTestId("forecast").innerText()), "30-day forecast finds the lowest balance");
  await shot("54-paycheck", true);

  await page.goto(`${base}/import`);
  const due = new Date(NOW);
  const csv = `Date,Description,Amount\n${iso(due)},OAK ST RENT PAYMENT,-1400.00\n${iso(due)},COFFEE,-4.50\n`;
  await page.getByTestId("csv-input").fill(csv);
  await page.getByTestId("csv-read").click();
  await page.getByTestId("imp-info").waitFor();
  const imp = await page.getByTestId("imp-info").innerText();
  check(/Read 2 rows/.test(imp), "bank CSV is read on the device");
  check((await page.getByTestId("match-row").count()) === 0 || (await page.getByTestId("match-apply").count()) === 1, "matches are offered for confirmation");
  await shot("55-import");

  await page.goto(`${base}/debts`);
  for (const [n, b, a, m] of [["Visa", "3000", "24.99", "90"], ["Car loan", "1000", "8", "50"]]) {
    await page.getByTestId("debt-name").fill(n);
    await page.getByTestId("debt-balance").fill(b);
    await page.getByTestId("debt-apr").fill(a);
    await page.getByTestId("debt-min").fill(m);
    await page.getByTestId("debt-add").click();
  }
  await page.getByTestId("debt-extra").fill("100");
  await page.getByTestId("plan-avalanche").waitFor();
  check((await page.getByTestId("debt-row").count()) === 2 && /Visa → Car loan/.test(await page.getByTestId("plan-avalanche").innerText()) && /Car loan → Visa/.test(await page.getByTestId("plan-snowball").innerText()), "debt planner compares avalanche and snowball");
  await shot("56-debts", true);

  await page.goto(`${base}/credit`);
  await page.getByTestId("card-bal-0").fill("900");
  await page.getByTestId("card-lim-0").fill("2000");
  await page.getByTestId("util-result").waitFor();
  check(/45%/.test(await page.getByTestId("util-result").innerText()), "credit utilization is calculated");
  await page.getByTestId("credit-step-reports").click();
  check((await page.getByText("1 of 6 done").count()) === 1, "credit checklist tracks progress");
  await shot("57-credit");

  await page.goto(`${base}/goals`);
  await page.getByRole("button", { name: "Move-in fund" }).click();
  await page.getByTestId("goal-target").fill("3000");
  await page.getByTestId("goal-saved").fill("600");
  await page.getByTestId("goal-date").fill(iso(new Date(NOW.getTime() + 120 * 86_400_000)));
  await page.getByTestId("goal-create").click();
  await page.getByTestId("goal-card").waitFor();
  check(/Per paycheck/.test(await page.getByTestId("goal-card").innerText()), "savings goal shows per-paycheck amount");

  await page.goto(`${base}/found-money`);
  await page.getByTestId("program-card").first().waitFor();
  check((await page.getByTestId("program-card").count()) >= 8 && (await page.getByText("Never pay to apply").count()) >= 1, "found money lists official programs with a scam warning");
  await shot("58-found-money");

  await page.goto(`${base}/split`);
  await page.getByTestId("split-total").fill("3000");
  await page.getByTestId("split-share-0").fill("2");
  check(/\$2,000[\s\S]*\$1,000/.test(await page.getByTestId("split-result").innerText()), "roommate split by shares");

  await page.goto(`${base}/bills`);
  await page.getByTestId("bill-name").fill("Music");
  await page.getByTestId("bill-amount").fill("15.99");
  await page.getByTestId("bill-day").fill("9");
  await page.getByRole("button", { name: "Subscription", exact: true }).click();
  await page.getByTestId("bill-add").click();
  await page.getByTestId("sub-unused").first().click();
  check(/saves \$191\.88 a year/.test(await page.getByTestId("sub-savings").innerText()), "subscription audit shows yearly savings");

  await page.goto(`${base}/backup`);
  const store = JSON.parse(await page.evaluate(() => localStorage.getItem("housing-compass-renter-local-only"))).state;
  const backup = { app: "housing-compass", kind: "renter-backup", version: 1, createdAt: new Date(NOW).toISOString(), data: { rentSetup: store.rentSetup, payments: store.payments, bills: store.bills, billPaid: store.billPaid, takeHomeCents: store.takeHomeCents, waitlists: store.waitlists, pay: store.pay, debts: store.debts, goals: store.goals, unusedSubs: store.unusedSubs, creditDone: store.creditDone } };
  await page.getByTestId("backup-save").waitFor();
  check((await page.getByTestId("backup-save").count()) === 1, "backup can be saved as a file");
  await page.getByTestId("backup-input").fill("not json");
  await page.getByTestId("backup-check").click();
  check(/isn't a Housing Compass backup/.test(await page.getByTestId("backup-msg").innerText()), "bad backups are rejected without changes");
  await page.getByTestId("backup-input").fill(JSON.stringify(backup));
  await page.getByTestId("backup-check").click();
  await page.getByTestId("backup-restore").click();
  check(/Restored/.test(await page.getByTestId("backup-msg").innerText()), "backup restores after checking");
  if (!(store.debts.length === 2 && store.goals.length === 1 && store.pay)) check(false, `backup contents: ${backupSummaryLog(store)}`);

  await page.goto(`${base}/help`);
  await page.getByRole("button", { name: "Español" }).click();
  await page.goto(`${base}/money`);
  await page.getByText("Ahora mismo").waitFor();
  check((await page.getByText("Dinero por reclamar").count()) >= 1, "money hub renders in Spanish");
  await page.goto(`${base}/help`);
  await page.getByRole("button", { name: "English" }).click();
}
function backupSummaryLog(s) { return `${s.debts?.length} debts, ${s.goals?.length} goals, pay=${!!s.pay}`; }

// ── v0.19: listing fit, letters, calendar, statement insights, money check, emergency fund, payoff dates, leftover split
{
  await page.goto(base);
  await page.getByText("DEMO · Sunny room in 3BR flat").first().click();
  await page.getByTestId("fit-panel").waitFor();
  check(/Left each month/.test(await page.getByTestId("fit-panel").innerText()), "listing shows whether it fits your money");
  await page.getByTestId("fit-goal").click();
  check((await page.getByText("Savings goal created — view it").count()) === 1, "a move-in savings goal can be created from a listing");
  await page.getByTestId("fit-panel").scrollIntoViewIfNeeded();
  await shot("59-listing-fit");

  await page.goto(`${base}/letters`);
  await page.getByTestId("letters").waitFor();
  check((await page.getByTestId("let-rr").count()) === 1 && (await page.getByTestId("let-pp").count()) === 1, "letters for rent reporting and payment plans");
  await page.getByTestId("let-pp").click();
  check((await page.getByText(/Enter the amount owed/).count()) === 1, "payment plan letter checks the amount");

  await page.goto(`${base}/calendar`);
  await page.getByTestId("calendar").waitFor();
  check((await page.getByTestId("cal-mark").count()) >= 2, "money calendar marks paydays and due dates");
  await page.getByTestId("cal-mark").first().click();
  await page.getByTestId("cal-day").waitFor();
  await shot("60-calendar");

  await page.goto(`${base}/import`);
  const rows = ["Date,Description,Amount"];
  for (const d of ["2026-08-07", "2026-08-21", "2026-09-04", "2026-09-18"]) rows.push(`${d},ACME PAYROLL,1500.00`);
  for (const d of ["2026-08-09", "2026-09-09", "2026-10-09"]) rows.push(`${d},SPOTIFY USA,-11.99`);
  rows.push("2026-08-10,SAFEWAY 123,-80.00", "2026-08-11,UBER TRIP,-22.00");
  await page.getByTestId("csv-input").fill(rows.join("\n"));
  await page.getByTestId("csv-read").click();
  await page.getByTestId("spend-summary").waitFor();
  check(/Groceries/.test(await page.getByTestId("spend-summary").innerText()), "statement spending is grouped");
  check((await page.getByTestId("recurring-row").count()) === 1 && /Spotify/.test(await page.getByTestId("recurring-row").innerText()), "repeating charges are found");
  check(/every 2 weeks, about \$1,500/i.test(await page.getByTestId("income-found").innerText()), "pay frequency and amount are detected");
  await shot("61-insights", true);

  await page.goto(`${base}/money`);
  await page.getByTestId("money-check").waitFor();
  check(/\d+\s*\/ 100/.test(await page.getByTestId("money-check").innerText()), "money check shows a score out of 100");
  await page.getByTestId("ef-saved").fill("2000");
  await page.getByTestId("ef-save").click();
  await page.getByTestId("ef-meter").waitFor();
  check(/Covers [\d.]+ months/.test(await page.getByTestId("ef-meter").innerText()), "emergency fund measured in months");
  await page.getByTestId("weekly-toggle").click();
  check(/phone app/.test(await page.getByTestId("weekly-msg").innerText()), "weekly check-in explains it runs on the phone");
  await page.getByTestId("money-check").scrollIntoViewIfNeeded();
  await shot("62-money-check");

  await page.goto(`${base}/debts`);
  await page.getByTestId("payoff-dates").waitFor();
  check(/\d{4}-\d{2}/.test(await page.getByTestId("payoff-dates").innerText()), "debt payoff dates shown");

  await page.goto(`${base}/paycheck`);
  await page.getByTestId("split-pct").waitFor();
  check((await page.getByText(/Goals \$[\d,.]+ · extra debt/).count()) >= 1, "leftover split per paycheck");

  await page.goto(`${base}/bills`);
  await page.getByTestId("bill-tips").first().click();
  check((await page.getByTestId("bill-tips-box").count()) === 1, "bill-lowering tips per bill");

  await page.goto(`${base}/plan`);
  await page.getByTestId("plan-item").first().waitFor();
  check((await page.getByText("Payday", { exact: true }).count()) >= 1, "My plan includes paydays");

  await page.goto(`${base}/help`);
  await page.getByRole("button", { name: "Español" }).click();
  await page.goto(`${base}/calendar`);
  await page.getByText("Calendario de dinero").first().waitFor();
  check(true, "money calendar renders in Spanish");
  await page.goto(`${base}/help`);
  await page.getByRole("button", { name: "English" }).click();
}

// ── v0.20: side income, mileage, tax set-aside, yearly costs, deposit interest, local rent limits, what-if, bill changes, streaks, year in review
{
  const iso = (d) => d.toISOString().slice(0, 10);
  await page.goto(`${base}/side-income`);
  await page.getByTestId("side-source").fill("DoorDash");
  await page.getByTestId("side-amount").fill("400");
  await page.getByTestId("side-add").click();
  await page.getByTestId("side-miles").fill("100");
  await page.getByTestId("side-purpose").fill("Deliveries");
  await page.getByTestId("side-log-miles").click();
  await page.getByTestId("side-entry").nth(1).waitFor();
  check((await page.getByTestId("side-year").innerText()) === "$400", "side income totals for the year");
  check((await page.getByTestId("side-mileage").innerText()) === "$76", "mileage deduction uses the IRS rate for the trip date");
  check((await page.getByTestId("side-setaside").innerText()) === "$81", "tax set-aside is a share of profit after mileage");
  check((await page.getByText(/2027-01-15/).count()) >= 1, "quarterly estimated-tax dates listed");
  await shot("63-side-income", true);

  await page.goto(`${base}/yearly`);
  await page.getByRole("button", { name: "Renters insurance" }).click();
  await page.getByTestId("yearly-amount").fill("150");
  await page.getByTestId("yearly-due").fill(iso(new Date(NOW.getTime() + 20 * 86_400_000)));
  await page.getByTestId("yearly-create").click();
  await page.getByTestId("yearly-card").waitFor();
  check(/\$150/.test(await page.getByTestId("yearly-total").innerText()), "yearly cost spread into a monthly amount");
  await shot("64-yearly");
  await page.goto(`${base}/plan`);
  await page.getByTestId("plan-item").first().waitFor();
  check((await page.getByText(/Renters insurance · \$150/).count()) >= 1, "upcoming yearly cost appears in My plan");

  await page.goto(`${base}/deposit-interest`);
  await page.getByTestId("dep-amount").fill("2000");
  check((await page.getByTestId("dep-result").innerText()).includes("$84"), "deposit interest estimate uses the official rate");

  await page.goto(`${base}/rent-increase`);
  await page.getByTestId("inc-current").fill("2000");
  await page.getByTestId("inc-new").fill("2100");
  await page.getByRole("button", { name: "San Francisco", exact: true }).click();
  await page.getByTestId("local-result").waitFor();
  check(/\$68 more than the local limit/.test(await page.getByTestId("local-result").innerText()), "local rent-control limit compared by city");
  await page.getByTestId("local-result").scrollIntoViewIfNeeded();
  await shot("65-local-limit");

  await page.goto(`${base}/debts`);
  await page.getByTestId("debt-extra").fill("50");
  await page.getByTestId("debt-whatif").waitFor();
  check(/What \$50 extra/.test(await page.getByTestId("debt-whatif").innerText()), "what-if extra debt payment shown");

  await page.goto(`${base}/import`);
  await page.getByTestId("csv-input").fill("Date,Description,Amount\n2026-10-03,PG&E WEB ONLINE,-140.00\n");
  await page.getByTestId("csv-read").click();
  await page.getByTestId("bill-change").waitFor();
  check(/PG&E went up 56%/.test(await page.getByTestId("bill-change").innerText()), "bill amount change spotted from a statement");
  await page.getByTestId("bill-change-update").click();
  await page.getByTestId("bill-change").waitFor({ state: "detached" });

  await page.goto(`${base}/goals`);
  await page.getByTestId("goal-name").fill("Test fund");
  await page.getByTestId("goal-target").fill("100");
  await page.getByTestId("goal-create").click();
  const tf = page.getByTestId("goal-card").filter({ hasText: "Test fund" });
  await tf.getByTestId("goal-add-amount").fill("30");
  await tf.getByTestId("goal-add-btn").click();
  check((await tf.getByTestId("goal-cheer").innerText()).includes("25%"), "goal milestone celebrated");
  check(/1-week saving streak/.test(await page.getByTestId("saving-streak").innerText()), "saving streak counted");
  await shot("66-goal-streak");

  await page.goto(`${base}/money`);
  await page.getByTestId("earn-side").waitFor();
  check(/\$400 earned this month/.test(await page.getByTestId("earn-side").innerText()), "money hub has an earn-more section");

  await page.goto(`${base}/year-review`);
  await page.getByTestId("yir-card").waitFor();
  check(/\$400/.test(await page.getByTestId("yir-card").innerText()), "year in review totals side income");
  await shot("67-year-review");
}

// ── v0.21: safe to spend, week ahead, side-work expenses & hourly pay, monthly goal, credit tracker, bill wins, roommates, card timing, payoff-by, bills in work hours
{
  await page.goto(`${base}/money`);
  await page.getByTestId("safe-to-spend").waitFor();
  check(/\$[\d,]+/.test(await page.getByTestId("safe-to-spend").innerText()), "safe to spend today shown");
  check((await page.getByTestId("tool-wins").count()) === 1 && (await page.getByTestId("tool-roommates").count()) === 1, "money hub links bill wins and roommates");
  await shot("68-today");

  await page.goto(`${base}/side-income`);
  await page.getByTestId("side-source").fill("Instacart");
  await page.getByTestId("side-amount").fill("100");
  await page.getByTestId("side-hours").fill("4");
  await page.getByTestId("side-add").click();
  await page.getByTestId("side-exp-amount").fill("20");
  await page.getByTestId("side-exp-add").click();
  await page.getByTestId("side-expenses").waitFor();
  check((await page.getByTestId("side-expenses").innerText()) === "$20", "side-work expenses tracked");
  check(/\/h/.test(await page.getByTestId("side-hourly").innerText()), "real hourly pay after costs shown");
  await page.getByTestId("side-goal-input").fill("1000");
  await page.getByTestId("side-goal-save").click();
  check(/of \$1,000 this month/.test(await page.getByTestId("side-goal").innerText()), "monthly side-income goal tracked");

  await page.goto(`${base}/credit-tools`);
  await page.getByTestId("report-experian").click();
  check((await page.getByText("Checked — free again on 2026-11-12").count()) === 1, "free weekly report check dates");
  await page.getByTestId("inq-lender").fill("Car loan");
  await page.getByTestId("inq-date").fill("2026-01-10");
  await page.getByTestId("inq-add").click();
  check(/Counts until 2027-01-10/.test(await page.getByTestId("inquiry-row").innerText()), "hard inquiry shows when it stops counting");
  await page.getByTestId("dispute-item").fill("Late payment I didn't make");
  await page.getByTestId("dispute-sent").fill("2026-10-01");
  await page.getByTestId("dispute-add").click();
  check(/Response late/.test(await page.getByTestId("dispute-row").innerText()), "dispute past 30 days flagged");
  await shot("69-credit-tracker", true);
  await page.goto(`${base}/plan`);
  await page.getByTestId("plan-item").first().waitFor();
  check((await page.getByText(/Response is late — follow up/).count()) >= 1, "late dispute appears in My plan");

  await page.goto(`${base}/wins`);
  await page.getByTestId("win-company").fill("Comcast");
  await page.getByTestId("win-monthly").fill("20");
  await page.getByTestId("win-add").click();
  await page.getByTestId("win-card").waitFor();
  check(/\$20\/mo/.test(await page.getByTestId("win-card").innerText()) && (await page.getByTestId("wins-year").innerText()) !== "$0", "bill wins add up over 12 months");
  await shot("70-wins");

  await page.goto(`${base}/roommates`);
  await page.getByTestId("iou-person").fill("Sam");
  await page.getByTestId("iou-amount").fill("45");
  await page.getByTestId("iou-add").click();
  check(/Sam owes you \$45/.test(await page.getByTestId("iou-balance").innerText()), "roommate balances");
  await page.getByTestId("share-bill").fill("Internet");
  await page.getByTestId("share-total").fill("90");
  await page.getByTestId("share-write").click();
  check(/Your share of Internet is \$45 \(total \$90\)/.test(await page.getByTestId("share-msg").innerText()), "share message written");
  await shot("71-roommates", true);

  await page.goto(`${base}/debts`);
  await page.getByTestId("debt-timing-edit").first().click();
  await page.getByTestId("debt-stmt-day").fill("20");
  await page.getByTestId("debt-timing-save").click();
  check(/Pay by 2026-11-18/.test(await page.getByTestId("debt-statement").first().innerText()), "pay-before-statement-closes date");
  check(/\/mo/.test(await page.getByTestId("payoff-by").innerText()), "pay off by a date calculator");

  await page.goto(`${base}/bills`);
  await page.getByTestId("hourly-wage").fill("25");
  await page.getByTestId("hourly-save").click();
  check((await page.getByText(/h of work/).count()) >= 1, "bills shown in work hours");
  await page.getByTestId("hourly-wage").scrollIntoViewIfNeeded();
  await shot("72-work-hours");
}

// ── v0.22: balance update, can I afford this, tool search, weekly spending, windfall, score journal, dispute letter, bill promo watch, debt progress
{
  const iso = (d) => d.toISOString().slice(0, 10);
  await page.goto(`${base}/money`);
  await page.getByTestId("today-balance").fill("5000");
  await page.getByTestId("today-balance-save").click();
  check(/\$[\d,]+/.test(await page.getByTestId("safe-to-spend").innerText()), "balance can be updated from the Today card");
  await page.getByTestId("tools-search").fill("score");
  check((await page.getByTestId("tool-scores").count()) === 1 && (await page.getByTestId("tool-paycheck").count()) === 0, "money tools can be searched");

  await page.goto(`${base}/afford`);
  await page.getByTestId("aff-price").fill("20");
  await page.getByTestId("aff-check").click();
  check(/Yes — it fits/.test(await page.getByTestId("aff-result").innerText()), "small purchase fits");
  await page.getByTestId("aff-price").fill("99999");
  await page.getByTestId("aff-check").click();
  check(/Not right now|Wait until payday/.test(await page.getByTestId("aff-result").innerText()), "large purchase flagged");
  await shot("73-afford");

  await page.goto(`${base}/spending`);
  await page.getByTestId("sp-limit").fill("100");
  await page.getByTestId("sp-limit-save").click();
  await page.getByRole("button", { name: "Coffee" }).click();
  await page.getByTestId("sp-amount").fill("30");
  await page.getByTestId("sp-add").click();
  await page.getByTestId("sp-row").waitFor();
  check(/\$70 left/.test(await page.getByTestId("sp-week").innerText()), "weekly spending shows what's left");
  check(/spent \$30 of \$100/.test(await page.getByTestId("sp-review").innerText()), "weekly review summarizes the week");
  await shot("74-spending");

  await page.goto(`${base}/windfall`);
  await page.getByTestId("wf-amount").fill("1000");
  await page.getByTestId("wf-plan").click();
  check(/For you/.test(await page.getByTestId("wf-result").innerText()), "windfall split shown");

  await page.goto(`${base}/scores`);
  for (const [s, d] of [["640", "2026-09-01"], ["662", "2026-11-01"]]) {
    await page.getByTestId("sc-score").fill(s);
    await page.getByTestId("sc-date").fill(d);
    await page.getByTestId("sc-source").fill("Bank app");
    await page.getByTestId("sc-add").click();
  }
  check(/\+22 since your last Bank app score/.test(await page.getByTestId("sc-latest").innerText()), "score journal shows change from the same source");
  await shot("75-scores");

  await page.goto(`${base}/letters`);
  await page.getByTestId("dl-item").fill("Acme Card ending 1234: late payment in March");
  await page.getByTestId("let-dl").click();
  check((await page.getByText("Describe the item you're disputing.").count()) === 0, "dispute letter can be made");

  await page.goto(`${base}/bills`);
  await page.getByTestId("bill-name").fill("Internet promo");
  await page.getByTestId("bill-amount").fill("50");
  await page.getByTestId("bill-day").fill("12");
  await page.getByTestId("bill-promo").fill(iso(new Date(NOW.getTime() + 10 * 86_400_000)));
  await page.getByTestId("bill-add").click();
  await page.goto(`${base}/plan`);
  await page.getByTestId("plan-item").first().waitFor();
  check((await page.getByText(/Promo price ends in \d+ days/).count()) >= 1, "bill promo end appears in My plan");
  await shot("76-plan-promo");

  await page.goto(`${base}/debts`);
  await page.getByTestId("debt-timing-edit").first().click();
  await page.getByTestId("debt-balance-update").fill("100");
  await page.getByTestId("debt-timing-save").click();
  await page.getByTestId("debt-progress").waitFor();
  check(/You've paid down/.test(await page.getByTestId("debt-progress").innerText()), "debt progress against the starting balance");
  await shot("77-debt-progress");
}

// ── v0.23: setup progress, net worth, 52-week challenge, card use, proof of payment, autopay check, late-fee letter, spending categories
{
  await page.goto(`${base}/money`);
  await page.getByTestId("safe-to-spend").waitFor();
  check((await page.getByTestId("setup-progress").count()) === 0 || /Money setup: \d of 9 done/.test(await page.getByTestId("setup-progress").innerText()), "money setup progress shown until complete");
  check((await page.getByTestId("tool-net-worth").count()) === 1 && (await page.getByTestId("tool-challenge").count()) === 1, "money hub links net worth and the challenge");

  await page.goto(`${base}/plan`);
  await page.getByTestId("plan-item").first().waitFor();
  check((await page.getByText("Update your net worth for this month").count()) === 1, "monthly net worth update in My plan");
  await page.goto(`${base}/net-worth`);
  await page.getByTestId("nw-other").fill("2500");
  await page.getByTestId("nw-other-save").click();
  check(/\$2,500/.test(await page.getByTestId("nw-now").innerText()), "net worth includes other assets");
  await page.getByTestId("nw-save").click();
  await page.getByTestId("nw-row").waitFor();
  check((await page.getByTestId("nw-row").count()) === 1, "net worth snapshot saved for the month");
  await shot("78-net-worth");

  await page.goto(`${base}/challenge`);
  await page.getByTestId("ch-start").click();
  await page.getByTestId("ch-status").waitFor();
  check(/Week 1 of 52/.test(await page.getByTestId("ch-status").innerText()) && /Save \$1 this week/.test(await page.getByTestId("ch-status").innerText()), "52-week challenge starts at week 1");
  await page.getByTestId("ch-week-1").click();
  check(/\$1 \/ \$1,378/.test(await page.getByTestId("ch-status").innerText()), "challenge weeks check off");
  await shot("79-challenge");

  await page.goto(`${base}/debts`);
  await page.getByTestId("debt-timing-edit").first().click();
  await page.getByTestId("debt-limit").fill("1000");
  await page.getByTestId("debt-timing-save").click();
  await page.getByTestId("card-util").waitFor();
  check(/Overall: \d+% of your limits in use/.test(await page.getByTestId("card-util").innerText()), "card use and pay-to-target shown");
  await page.getByTestId("card-util").scrollIntoViewIfNeeded();
  await shot("80-card-use");

  await page.goto(`${base}/bills`);
  await page.getByTestId("bill-add").waitFor();
  if (await page.getByTestId("proof-row").count()) {
    await page.getByTestId("proof-input").first().fill("#A1B2C3");
    await page.getByTestId("proof-save").first().click();
    await page.reload();
    await page.getByTestId("proof-input").first().waitFor();
    check((await page.getByTestId("proof-input").first().inputValue()) === "#A1B2C3", "proof of payment saved");
  }
  check((await page.getByTestId("autopay-off").count()) >= 1, "autopay checklist lists bills not on autopay");

  await page.goto(`${base}/letters`);
  await page.getByTestId("lf-company").fill("PG&E");
  await page.getByTestId("lf-fee").fill("10");
  await page.getByTestId("let-lf").click();
  check((await page.getByTestId("lf-company").count()) === 1, "late fee waiver letter can be made");

  await page.goto(`${base}/spending`);
  await page.getByRole("button", { name: "Shopping" }).click();
  await page.getByTestId("sp-amount").fill("20");
  await page.getByTestId("sp-add").click();
  await page.getByTestId("sp-recap").waitFor();
  check(/Shopping/.test(await page.getByTestId("sp-recap").innerText()), "spending recap by category");
  await page.getByTestId("sp-recap").scrollIntoViewIfNeeded();
  await shot("81-spending-recap");
}

// ── v0.15: Spanish filters and message checker
await page.goto(`${base}/help`);
await page.getByRole("button", { name: "Español" }).click();
await page.goto(`${base}/filters`);
await page.getByText("Presupuesto", { exact: true }).waitFor();
check((await page.getByRole("button", { name: "Total mensual más bajo" }).count()) === 1, "filters render in Spanish");
await page.goto(`${base}/check-message`);
await page.getByLabel("Pega el mensaje aquí").fill("Send the deposit by Zelle before the tour, many people are interested");
await page.getByTestId("check-message").click();
await page.getByText("Alto — no envíes dinero ni datos personales").waitFor();
check((await page.getByText(/Pide dinero antes de que visites/).count()) === 1, "message-checker warnings are translated");
await shot("43-spanish-message-check");
await page.goto(`${base}/help`);
await page.getByRole("button", { name: "English" }).click();

// ── v0.14: Simplified Chinese + translated listing detail (Spanish)
await page.goto(`${base}/help`);
await page.getByRole("button", { name: "简体中文" }).click();
await page.getByText("帮助与安全").waitFor();
check((await page.getByText("租房诈骗警示信号").count()) === 1, "Help & safety renders in Simplified Chinese");
await shot("37-chinese-help");
await page.getByRole("button", { name: "Español" }).click();
await page.goto(base);
await page.getByText("DEMO · Sunny room in 3BR flat").first().click();
await page.getByText("Cuánto cuesta").waitFor();
check((await page.getByText("De dónde viene").count()) === 1, "listing detail renders in Spanish");
await page.goto(`${base}/help`);
await page.getByRole("button", { name: "English" }).click();

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

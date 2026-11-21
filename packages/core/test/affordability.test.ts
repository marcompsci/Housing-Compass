import { describe, expect, it } from "vitest";
import { affordableMonthlyCents, checkEligibility, demoListings, moveInPlan, rentBurden, researchLeads, summarizeAffordability } from "../src/index";

const NOW = new Date("2026-11-03T12:00:00Z");
const ir = demoListings(NOW).find((d) => d.id === "demo-official-1br-oakland")!; // limits: 1p $70k, 2p $80k; 2× rent; $1,248
const lead = researchLeads()[0]!;

describe("affordability", () => {
  it("uses HUD's 30% / 50% cost-burden thresholds", () => {
    expect(rentBurden(150000, 6000000).burden).toBe("affordable"); // 30%
    expect(rentBurden(200000, 6000000).burden).toBe("cost_burdened"); // 40%
    expect(rentBurden(300000, 6000000).burden).toBe("severely_cost_burdened"); // 60%
    expect(affordableMonthlyCents(6000000)).toBe(150000);
  });
  it("checks income limits only from the listing's own table", () => {
    expect(checkEligibility(ir, { householdSize: 1, annualIncomeCents: 6500000, savingsCents: 0 }).incomeLimit.verdict).toBe("yes");
    expect(checkEligibility(ir, { householdSize: 1, annualIncomeCents: 7500000, savingsCents: 0 }).incomeLimit.verdict).toBe("no");
    expect(checkEligibility(ir, { householdSize: 4, annualIncomeCents: 5000000, savingsCents: 0 }).incomeLimit.verdict).toBe("unknown");
  });
  it("checks minimum income multiples and says unknown when unstated", () => {
    expect(checkEligibility(ir, { householdSize: 1, annualIncomeCents: 2000000, savingsCents: 0 }).minimumIncome).toMatchObject({ verdict: "no", requiredAnnualCents: 1248 * 100 * 2 * 12 });
    expect(checkEligibility(lead, { householdSize: 1, annualIncomeCents: 5000000, savingsCents: 0 }).minimumIncome.verdict).toBe("unknown");
  });
  it("plans move-in money and lists what's unknown", () => {
    const p = moveInPlan(lead, { householdSize: 1, annualIncomeCents: 0, savingsCents: 0 });
    expect(p.complete).toBe(false);
    expect(p.unknownItems).toHaveLength(2);
    const d = moveInPlan(ir, { householdSize: 1, annualIncomeCents: 0, savingsCents: 20000 });
    expect(d).toMatchObject({ complete: true, knownUpfrontCents: 50000, shortfallCents: 30000 });
  });
  it("summarizes", () => {
    const s = summarizeAffordability(ir, { householdSize: 2, annualIncomeCents: 6000000, savingsCents: 100000 });
    expect(s.burden.burden).toBe("affordable");
    expect(s.eligibility.incomeLimit.verdict).toBe("yes");
  });
});

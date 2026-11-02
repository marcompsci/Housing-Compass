import { describe, expect, it } from "vitest";
import { CONTACT_HIDDEN, messageGuard } from "../src/index";

// Same inputs as supabase/tests/10_trust_tests.sql §19 — keep both in sync.
describe("message guard (parity with SQL trigger)", () => {
  it("masks phones, emails and links until a tour is confirmed", () => {
    const r = messageGuard("Hi! Call me at (510) 555-0199 or me@example.com", { tourConfirmed: false });
    expect(r.masked).toBe(true);
    expect(r.body).toBe(`Hi! Call me at ${CONTACT_HIDDEN} or ${CONTACT_HIDDEN}`);
    expect(messageGuard("see www.example.com/apply", { tourConfirmed: false }).body).toMatch(/link hidden/);
  });
  it("allows contact details after a confirmed tour", () => {
    expect(messageGuard("Great, my number is 510-555-0199", { tourConfirmed: true })).toMatchObject({ masked: false, held: false, body: "Great, my number is 510-555-0199" });
  });
  it("holds payment and sensitive-data requests with reasons", () => {
    const r = messageGuard("Thanks — to hold it, send a $500 deposit by gift card before the tour", { tourConfirmed: false });
    expect(r.held).toBe(true);
    expect(r.holdReasons).toEqual(["off-platform payment", "payment before tour"]);
    expect(messageGuard("Pay at paypal.me/x", { tourConfirmed: true }).holdReasons).toEqual(["payment link"]);
    expect(messageGuard("Send your SSN first", { tourConfirmed: false }).holdReasons).toEqual(["sensitive personal data request"]);
  });
  it("lets normal messages through untouched", () => {
    expect(messageGuard("Tours are Saturday 10–12, see you then.", { tourConfirmed: false })).toEqual({ body: "Tours are Saturday 10–12, see you then.", masked: false, held: false, holdReasons: [] });
  });
  it("is stateless across calls (global regex lastIndex reset)", () => {
    for (let i = 0; i < 3; i += 1) expect(messageGuard("me@example.com", { tourConfirmed: false }).masked).toBe(true);
  });
});

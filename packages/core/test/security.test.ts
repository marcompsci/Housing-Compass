import { describe, expect, it } from "vitest";
import { checkReceivedMessage, dHash, hammingHex } from "../src/index";

describe("received-message safety check", () => {
  it("stops on classic rental-scam messages", () => {
    const r = checkReceivedMessage("I'm out of the country so I can't show the apartment. Send the deposit by Zelle or gift cards today to hold it, many people are interested. Text me on WhatsApp.");
    expect(r.level).toBe("stop");
    expect(r.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["NO_VIEWING", "PRESSURE", "MOVE_OFF_PLATFORM", "OFF_PLATFORM_PAYMENT"]));
  });
  it("flags SSN/bank requests and overpayment refunds", () => {
    expect(checkReceivedMessage("Please send your SSN and bank login so I can run a check").warnings[0]!.code).toBe("SENSITIVE_INFO_EARLY");
    expect(checkReceivedMessage("I sent too much on the check, please refund the difference").level).toBe("stop");
  });
  it("lets an ordinary message through", () => {
    expect(checkReceivedMessage("Hi! Showings are Saturday 10–12. The application is on our website; the fee is charged after the tour.").level).toBe("looks_ok");
  });
  it("never calls the sender a scammer", () => {
    const r = checkReceivedMessage("wire the money now, bitcoin ok, can't view");
    expect(r.warnings.length).toBeGreaterThan(0);
    for (const w of r.warnings) expect(`${w.why} ${w.doThis}`).not.toMatch(/\bscammer\b|\bfraudster\b/i);
  });
});

function img(w: number, h: number, f: (x: number, y: number) => number): Uint8Array {
  const a = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const v = f(x, y), i = (y * w + x) * 4;
    a[i] = a[i + 1] = a[i + 2] = v;
    a[i + 3] = 255;
  }
  return a;
}

describe("dHash", () => {
  const gradient = (x: number, y: number) => Math.min(255, (x * 7 + y * 3) % 256);
  const photo = img(180, 120, (x, y) => (Math.sin(x / 9) * 60 + Math.cos(y / 7) * 60 + 128) | 0);
  it("is stable across resizing and small brightness changes", () => {
    const small = img(90, 60, (x, y) => (Math.sin((x * 2) / 9) * 60 + Math.cos((y * 2) / 7) * 60 + 128) | 0);
    const brighter = img(180, 120, (x, y) => Math.min(255, ((Math.sin(x / 9) * 60 + Math.cos(y / 7) * 60 + 128) | 0) + 10));
    const h = dHash(photo, 180, 120);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(hammingHex(h, dHash(small, 90, 60))).toBeLessThanOrEqual(5);
    expect(hammingHex(h, dHash(brighter, 180, 120))).toBeLessThanOrEqual(5);
  });
  it("differs for different images", () => {
    expect(hammingHex(dHash(photo, 180, 120), dHash(img(180, 120, gradient), 180, 120))).toBeGreaterThan(10);
  });
});

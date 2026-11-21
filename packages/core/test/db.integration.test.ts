/**
 * Integration: the database's listing documents must parse with the SAME zod schema the app uses.
 * Runs only when DATABASE_URL is set (scripts/db-test.sh sets it after migrations + seeds + SQL tests).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { ListingSchema, search, DEFAULT_FILTERS, categorize } from "../src/index";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("database ↔ core contract", () => {
  const client = new pg.Client({ connectionString: url });
  beforeAll(async () => {
    await client.connect();
    await client.query("set role anon");
  });
  afterAll(async () => {
    await client.query("reset role");
    await client.end();
  });

  it("anon search returns only verified levels by default (no unverified, demo, flagged, expired)", async () => {
    const { rows } = await client.query("select search_listings('ENTIRE_1BR') as doc");
    for (const r of rows) {
      const l = ListingSchema.parse(r.doc);
      expect(["OFFICIAL_PORTAL", "PROPERTY_MANAGER_VERIFIED"]).toContain(l.verification.level);
      expect(l.isDemo).toBe(false);
    }
    // lead-oakland-801-14th-st was manager-verified with full evidence in 10_trust_tests.sql
    expect(rows.map((r) => r.doc.id)).toContain("lead-oakland-801-14th-st");
  });

  it("every document parses with ListingSchema and matches its SQL category", async () => {
    for (const cat of ["PRIVATE_ROOM", "SHARED_COLIVING", "STUDIO", "ENTIRE_1BR", "INCOME_RESTRICTED"]) {
      const { rows } = await client.query("select search_listings($1, true) as doc", [cat]);
      for (const r of rows) {
        const l = ListingSchema.parse(r.doc);
        expect(categorize(l)).toBe(cat);
        expect(l.verification.signals).toEqual([]); // risk signals never leave the server
      }
    }
  });

  it("radius filter uses PostGIS distance", async () => {
    const all = await client.query("select search_listings('PRIVATE_ROOM', true) as doc");
    const near = await client.query("select search_listings('PRIVATE_ROOM', true, 37.7749, -122.4194, 10) as doc");
    expect(near.rows.length).toBeGreaterThan(0);
    expect(near.rows.length).toBeLessThan(all.rows.length);
    expect(near.rows.every((r) => r.doc.address.city === "San Francisco")).toBe(true);
  });

  it("documents feed straight into core.search()", async () => {
    const { rows } = await client.query("select search_listings('PRIVATE_ROOM', true) as doc");
    const listings = rows.map((r) => ListingSchema.parse(r.doc));
    const res = search(listings, { ...DEFAULT_FILTERS, region: null, category: "PRIVATE_ROOM", includeUnverified: true });
    expect(res.hits.length).toBe(listings.length);
  });

  it("get_listing and expired_lead_count work for anon", async () => {
    const one = await client.query("select get_listing('lead-oakland-801-14th-st') as doc");
    expect(ListingSchema.parse(one.rows[0].doc).id).toBe("lead-oakland-801-14th-st");
    const n = await client.query("select expired_lead_count() as n");
    expect(n.rows[0].n).toBeGreaterThanOrEqual(1);
  });
});

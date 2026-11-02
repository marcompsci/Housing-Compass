// Builds the OFFLINE fallback basemap (county outlines) used when no tile server is reachable.
// Data: US Census Bureau cartographic boundaries via the `us-atlas` package (1:10M, generalized).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { feature } from "topojson-client";
const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve("us-atlas/counties-10m.json"), "utf8"));
const BAY = { "06001": "Alameda", "06013": "Contra Costa", "06041": "Marin", "06055": "Napa", "06075": "San Francisco", "06081": "San Mateo", "06085": "Santa Clara", "06095": "Solano", "06097": "Sonoma" };
// Los Angeles County is a focus region; its neighbors give context.
BAY["06037"] = "Los Angeles";
const SOCAL = ["06059", "06111", "06071", "06029", "06065", "06083"];
const NEAR = [...SOCAL, "06067", "06077", "06087", "06113", "06033", "06045", "06069", "06099", "06011", "06057", "06061", "06017", "06005", "06009", "06047", "06053", "06043", "06109", "06021", "06007", "06115", "06101"];
const fc = feature(topo, topo.objects.counties);
const r = (n) => Math.round(n * 1e4) / 1e4;
const round = (c) => (typeof c[0] === "number" ? [r(c[0]), r(c[1])] : c.map(round));
const features = fc.features
  .filter((f) => BAY[f.id] || NEAR.includes(f.id))
  .map((f) => ({ type: "Feature", properties: { fips: f.id, name: f.properties.name, bay: !!BAY[f.id] }, geometry: { ...f.geometry, coordinates: round(f.geometry.coordinates) } }));
writeFileSync("apps/mobile/src/map/bayAreaCounties.json", JSON.stringify({ type: "FeatureCollection", features }));
console.log("counties:", features.length, features.filter((f) => f.properties.bay).map((f) => f.properties.name).join(", "));

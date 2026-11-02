// Builds packages/core/src/data/ca-zips.json (ZIP → approximate centroid + city) for manual ZIP entry.
// Data: `zipcodes` npm package (BSD; sourced from federalgovernmentzipcodes.us). Centroids are approximate.
import { writeFileSync } from "node:fs";
import zipcodes from "zipcodes";
const rows = Object.values(zipcodes.codes)
  .filter((c) => c.state === "CA" && c.latitude && c.longitude)
  .map((c) => [c.zip, Math.round(c.latitude * 1e4) / 1e4, Math.round(c.longitude * 1e4) / 1e4, c.city])
  .sort((a, b) => a[0].localeCompare(b[0]));
writeFileSync("packages/core/src/data/ca-zips.json", JSON.stringify(rows));
console.log("CA zips:", rows.length);

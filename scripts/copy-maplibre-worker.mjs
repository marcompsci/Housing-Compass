// maplibre-gl loads its web worker from a URL relative to its own module, which bundlers (Metro) break.
// Copy the worker into the web app's public/ folder; ListingsMap.web.tsx points setWorkerUrl at it.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const src = join(dirname(require.resolve("maplibre-gl/package.json", { paths: ["apps/mobile"] })), "dist/maplibre-gl-worker.mjs");
mkdirSync("apps/mobile/public/maplibre", { recursive: true });
copyFileSync(src, "apps/mobile/public/maplibre/maplibre-gl-worker.mjs");
console.log("copied maplibre worker");

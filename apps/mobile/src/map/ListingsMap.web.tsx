import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatUsd } from "@housing-compass/core";
import { color, type } from "../theme";
import { AREA_PAINT, PIN_COLORS, areaShape, toMapModels, useMapStyle, type ListingsMapProps } from "./style";

// See scripts/copy-maplibre-worker.mjs — the worker is served from public/.
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export default function ListingsMap({ hits, center, selectedId, onSelectListing, onSelectArea, drawing, areaPoints = [], onMapPress }: ListingsMapProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const { style, offline, attribution } = useMapStyle();
  const press = useRef<{ drawing: boolean; onMapPress?: (p: { lat: number; lng: number }) => void }>({ drawing: false });
  press.current = { drawing: !!drawing, onMapPress };
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    if (!host.current) return;
    const m = new maplibregl.Map({
      container: host.current,
      style: style as maplibregl.StyleSpecification | string,
      center: [center.lng, center.lat],
      zoom: 8.6,
      attributionControl: false,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("click", (e) => {
      const p = press.current;
      if (p.drawing && p.onMapPress) p.onMapPress({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
    m.on("load", () => {
      m.addSource("search-area", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "search-area-fill", type: "fill", source: "search-area", filter: ["==", ["get", "kind"], "area"], paint: AREA_PAINT.fill });
      m.addLayer({ id: "search-area-line", type: "line", source: "search-area", filter: ["!=", ["get", "kind"], "vertex"], paint: AREA_PAINT.line as never });
      m.addLayer({ id: "search-area-vertex", type: "circle", source: "search-area", filter: ["==", ["get", "kind"], "vertex"], paint: AREA_PAINT.vertex });
      setLoaded((n) => n + 1);
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // style swap recreates the map; center changes are handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    map.current?.easeTo({ center: [center.lng, center.lat], duration: reduce ? 0 : 400 });
  }, [center.lat, center.lng]);

  const shapeKey = JSON.stringify(areaPoints);
  useEffect(() => {
    const m = map.current;
    const src = m?.getSource("search-area") as maplibregl.GeoJSONSource | undefined;
    if (!m || !src) return;
    src.setData(areaShape(areaPoints) ?? { type: "FeatureCollection", features: [] });
    m.setLayoutProperty("search-area-vertex", "visibility", drawing ? "visible" : "none");
    m.getCanvas().style.cursor = drawing ? "crosshair" : "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeKey, drawing, loaded]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    const { pins, areas } = toMapModels(hits);
    if (drawing) return;

    for (const a of areas) {
      const el = document.createElement("button");
      el.className = "hc-area";
      el.setAttribute("aria-label", `${a.count} unverified leads in ${a.city}, approximate city-level location, from ${formatUsd(a.fromCents)}`);
      el.innerHTML = `<strong>${a.count}</strong> lead${a.count === 1 ? "" : "s"} · ${a.city}<br/><span>approx. area · from ${formatUsd(a.fromCents)}</span>`;
      el.onclick = (e) => {
        e.stopPropagation();
        onSelectArea(a.city);
      };
      markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([a.lng, a.lat]).addTo(m));
    }
    for (const p of pins) {
      const c = PIN_COLORS[p.tone];
      const el = document.createElement("button");
      el.className = "hc-pin" + (p.id === selectedId ? " hc-pin-on" : "");
      el.style.background = c.bg;
      el.style.color = c.fg;
      el.style.borderColor = c.border;
      el.setAttribute("aria-label", `Listing ${p.label}`);
      el.textContent = p.label;
      el.onclick = (e) => {
        e.stopPropagation();
        onSelectListing(p.id);
      };
      markers.current.push(new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lng, p.lat]).addTo(m));
    }
  }, [hits, selectedId, onSelectArea, onSelectListing, style, drawing]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <style>{CSS}</style>
      <div ref={host} style={{ position: "absolute", inset: 0 }} data-testid="map" data-drawing={drawing ? "true" : "false"} />
      <View style={styles.attrib} pointerEvents="none">
        <Text style={[type.tiny, { color: color.sub }]}>
          {offline ? "Offline map · " : ""}
          {attribution}
        </Text>
      </View>
    </View>
  );
}

const CSS = `
.hc-pin{font:800 13px system-ui,-apple-system,sans-serif;padding:5px 9px;border-radius:999px;border:2px solid;box-shadow:0 2px 6px rgba(19,32,47,.25);cursor:pointer;white-space:nowrap}
.hc-pin-on{transform:scale(1.15);box-shadow:0 0 0 3px #13202F}
.hc-area{font:600 12px system-ui,-apple-system,sans-serif;line-height:1.25;text-align:center;padding:8px 12px;border-radius:14px;background:rgba(255,243,214,.94);color:#8A4F00;border:2px dashed #C88A12;cursor:pointer}
.hc-area span{font-weight:500;font-size:11px;color:#6B4A10}
.maplibregl-ctrl-group button{width:36px;height:36px}
`;

const styles = StyleSheet.create({
  attrib: { position: "absolute", left: 8, top: 8, maxWidth: "70%", backgroundColor: "rgba(255,255,255,0.85)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
});

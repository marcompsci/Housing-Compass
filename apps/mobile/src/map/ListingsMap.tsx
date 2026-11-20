/**
 * Native map (iOS/Android) using MapLibre Native. Requires a development build
 * (`npx expo run:ios|android` or EAS) — MapLibre is not included in Expo Go.
 */
import { Camera, GeoJSONSource, Layer, Map, Marker, type StyleSpecification } from "@maplibre/maplibre-react-native";
import { formatUsd } from "@housing-compass/core";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { color, type } from "../theme";
import { AREA_PAINT, PIN_COLORS, areaShape, toMapModels, useMapStyle, type ListingsMapProps } from "./style";

export default function ListingsMap({ hits, center, selectedId, onSelectListing, onSelectArea, drawing, areaPoints = [], onMapPress }: ListingsMapProps) {
  const { style, offline, attribution } = useMapStyle();
  const { pins, areas } = toMapModels(hits);
  const shape = areaShape(areaPoints);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={style as string | StyleSpecification}
        attribution={false}
        logo={false}
        compass={false}
        onPress={(e) => {
          if (!drawing || !onMapPress) return;
          const [lng, lat] = e.nativeEvent.lngLat;
          onMapPress({ lat, lng });
        }}
      >
        <Camera initialViewState={{ center: [center.lng, center.lat], zoom: 8.6 }} center={[center.lng, center.lat]} />
        {shape ? (
          <GeoJSONSource id="search-area" data={shape}>
            <Layer id="search-area-fill" type="fill" filter={["==", ["get", "kind"], "area"]} paint={AREA_PAINT.fill} />
            <Layer id="search-area-line" type="line" filter={["!=", ["get", "kind"], "vertex"]} paint={AREA_PAINT.line as never} />
            {drawing ? <Layer id="search-area-vertex" type="circle" filter={["==", ["get", "kind"], "vertex"]} paint={AREA_PAINT.vertex} /> : null}
          </GeoJSONSource>
        ) : null}
        {(drawing ? [] : areas).map((a) => (
          <Marker key={`area-${a.key}`} id={`area-${a.key}`} lngLat={[a.lng, a.lat]}>
            <Pressable
              onPress={() => onSelectArea(a.city)}
              accessibilityRole="button"
              accessibilityLabel={`${a.count} unverified leads in ${a.city}, approximate city-level location, from ${formatUsd(a.fromCents)}`}
              style={styles.area}
            >
              <Text style={styles.areaTitle}>
                {a.count} lead{a.count === 1 ? "" : "s"} · {a.city}
              </Text>
              <Text style={styles.areaSub}>approx. area · from {formatUsd(a.fromCents)}</Text>
            </Pressable>
          </Marker>
        ))}
        {(drawing ? [] : pins).map((p) => {
          const c = PIN_COLORS[p.tone];
          return (
            <Marker key={p.id} id={p.id} lngLat={[p.lng, p.lat]} anchor="bottom">
              <Pressable
                onPress={() => onSelectListing(p.id)}
                accessibilityRole="button"
                accessibilityLabel={`Listing ${p.label}`}
                style={[styles.pin, { backgroundColor: c.bg, borderColor: c.border }, p.id === selectedId && styles.pinOn]}
              >
                <Text style={[styles.pinText, { color: c.fg }]}>{p.label}</Text>
              </Pressable>
            </Marker>
          );
        })}
      </Map>
      <View style={styles.attrib} pointerEvents="none">
        <Text style={[type.tiny, { color: color.sub }]}>
          {offline ? "Offline map · " : ""}
          {attribution}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pin: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 2 },
  pinOn: { transform: [{ scale: 1.15 }] },
  pinText: { fontSize: 13, fontWeight: "800" },
  area: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 2, borderStyle: "dashed", borderColor: "#C88A12", backgroundColor: "rgba(255,243,214,0.94)", alignItems: "center" },
  areaTitle: { fontSize: 12, fontWeight: "700", color: color.warn },
  areaSub: { fontSize: 11, color: "#6B4A10" },
  attrib: { position: "absolute", left: 8, top: 8, maxWidth: "70%", backgroundColor: "rgba(255,255,255,0.85)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
});

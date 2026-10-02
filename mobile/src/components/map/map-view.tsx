import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { buildRoute, type LatLng } from "@sofra/core";
import { useTheme } from "@/theme";
import { Text } from "@/components/ui/text";
import {
  centerOf,
  fitZoom,
  screenPosition,
  tileUrl,
  tilesFor,
  TILE_SIZE,
} from "./projection";

/**
 * Harita.
 *
 * OpenStreetMap karoları döşenir, üstüne SVG ile rota ve işaretçiler çizilir.
 * Web uygulamasındaki Leaflet haritasıyla aynı karo kaynağını kullandığı için
 * iki istemcide aynı sokaklar görünür.
 *
 * Harita verilen noktaların hepsini kapsayacak şekilde kendini ayarlar;
 * sürükleme ve yakınlaştırma yok (bkz. `projection.ts`).
 */

export interface MapMarker {
  point: LatLng;
  /** İşaretçinin içine yazılan emoji */
  emoji?: string;
  /** Halka rengi; verilmezse marka rengi */
  color?: string;
  label?: string;
  size?: number;
}

export function MapView({
  markers,
  /** İki nokta arasında kavisli bir rota çizer */
  route,
  height = 220,
  padding = 28,
  zoom: fixedZoom,
  style,
  rounded = 16,
}: {
  markers: MapMarker[];
  route?: { from: LatLng; to: LatLng } | null;
  height?: number;
  padding?: number;
  zoom?: number;
  style?: StyleProp<ViewStyle>;
  rounded?: number;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  const points = useMemo(() => {
    const list = markers.map((m) => m.point);
    if (route) list.push(route.from, route.to);
    return list;
  }, [markers, route]);

  const center = useMemo(() => centerOf(points), [points]);
  const zoom = useMemo(
    () => fixedZoom ?? fitZoom(points, width, height, padding),
    [fixedZoom, points, width, height, padding]
  );

  const tiles = useMemo(
    () => (width > 0 ? tilesFor(center, zoom, width, height) : []),
    [center, zoom, width, height]
  );

  const routePoints = useMemo(() => {
    if (!route || width === 0) return "";
    return buildRoute(route.from, route.to, 32)
      .map((p) => {
        const pos = screenPosition(p, center, zoom, width, height);
        return `${pos.x.toFixed(1)},${pos.y.toFixed(1)}`;
      })
      .join(" ");
  }, [route, center, zoom, width, height]);

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.wrap,
        {
          height,
          borderRadius: rounded,
          backgroundColor: t.colors.surface2,
          borderColor: t.colors.border,
        },
        style,
      ]}
    >
      {/* Karo katmanı */}
      {tiles.map((tile) => (
        <Image
          key={`${tile.z}/${tile.x}/${tile.y}`}
          source={{ uri: tileUrl(tile) }}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={140}
          style={{
            position: "absolute",
            left: tile.left,
            top: tile.top,
            width: TILE_SIZE,
            height: TILE_SIZE,
          }}
        />
      ))}

      {/* Rota + işaretçiler */}
      {width > 0 ? (
        <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
          {routePoints ? (
            <>
              {/* Altta beyaz kontur — karolar üzerinde okunur kalsın */}
              <Polyline
                points={routePoints}
                stroke="#ffffff"
                strokeOpacity={0.85}
                strokeWidth={6}
                strokeLinecap="round"
                fill="none"
              />
              <Polyline
                points={routePoints}
                stroke={t.colors.brand}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="1 7"
                fill="none"
              />
            </>
          ) : null}

          {markers.map((marker, i) => {
            const pos = screenPosition(
              marker.point,
              center,
              zoom,
              width,
              height
            );
            const r = (marker.size ?? 34) / 2;
            return (
              <Circle
                key={`ring-${i}`}
                cx={pos.x}
                cy={pos.y}
                r={r}
                fill={marker.color ?? t.colors.brand}
                stroke="#ffffff"
                strokeWidth={3}
              />
            );
          })}
        </Svg>
      ) : null}

      {/* İşaretçi emojileri — SVG metni yerine gerçek metin, emoji doğru render olsun */}
      {width > 0
        ? markers.map((marker, i) => {
            const pos = screenPosition(
              marker.point,
              center,
              zoom,
              width,
              height
            );
            const size = marker.size ?? 34;
            return (
              <View
                key={`pin-${i}`}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: pos.x - size / 2,
                  top: pos.y - size / 2,
                  width: size,
                  height: size,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: size * 0.5 }}>
                  {marker.emoji ?? "📍"}
                </Text>
              </View>
            );
          })
        : null}

      {/* OpenStreetMap lisansı atıf gerektirir */}
      <View
        style={[
          styles.credit,
          { backgroundColor: t.colors.surface, borderTopLeftRadius: 6 },
        ]}
      >
        <Text variant="caption" style={{ fontSize: 9, lineHeight: 12 }}>
          © OpenStreetMap
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth * 2,
    position: "relative",
  },
  credit: {
    position: "absolute",
    right: 0,
    bottom: 0,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
});

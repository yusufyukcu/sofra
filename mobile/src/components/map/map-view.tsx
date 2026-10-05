import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import type { IconName, LatLng } from "@sofra/core";
import { useTheme } from "@/theme";
import { Icon } from "@/components/ui/icon";
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
 * OpenStreetMap karoları döşenir, üstüne SVG ile yol çizgisi ve işaretçiler
 * çizilir. Çizgi, sunucunun yol tarifi servisinden aldığı gerçek yoldur
 * (`order.courierRoute`); yoksa çizgi çizilmez.
 * Web uygulamasındaki Leaflet haritasıyla aynı karo kaynağını kullandığı için
 * iki istemcide aynı sokaklar görünür.
 *
 * Harita verilen noktaların hepsini kapsayacak şekilde kendini ayarlar;
 * sürükleme ve yakınlaştırma yok (bkz. `projection.ts`).
 */

export interface MapMarker {
  point: LatLng;
  /** İşaretçinin içindeki ikon (`@sofra/core` adlarıyla) */
  icon?: IconName;
  /** Halka rengi; verilmezse marka rengi */
  color?: string;
  label?: string;
  size?: number;
}

export function MapView({
  markers,
  /** Çizilecek yol (kuryenin önündeki gerçek yol) */
  path,
  height = 220,
  padding = 28,
  zoom: fixedZoom,
  style,
  rounded = 16,
  routeColor,
}: {
  markers: MapMarker[];
  path?: LatLng[] | null;
  height?: number;
  padding?: number;
  zoom?: number;
  style?: StyleProp<ViewStyle>;
  rounded?: number;
  /** Yol çizgisinin rengi; verilmezse marka rengi */
  routeColor?: string;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  const points = useMemo(() => {
    const list = markers.map((m) => m.point);
    if (path) list.push(...path);
    return list;
  }, [markers, path]);

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
    if (!path || path.length < 2 || width === 0) return "";
    return path
      .map((p) => {
        const pos = screenPosition(p, center, zoom, width, height);
        return `${pos.x.toFixed(1)},${pos.y.toFixed(1)}`;
      })
      .join(" ");
  }, [path, center, zoom, width, height]);

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
                strokeWidth={8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <Polyline
                points={routePoints}
                stroke={routeColor ?? t.colors.brand}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
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

      {/* İşaretçi ikonları — halkanın tam ortasında */}
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
                <Icon name={marker.icon ?? "MapPin"} size={size * 0.5} color="#ffffff" strokeWidth={2.4} />
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
          {routePoints ? "© OpenStreetMap · OSRM" : "© OpenStreetMap"}
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

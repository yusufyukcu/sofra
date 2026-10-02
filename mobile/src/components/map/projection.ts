import type { LatLng } from "@sofra/core";

/**
 * Web Mercator projeksiyonu (EPSG:3857) — "slippy map" karo düzeni.
 *
 * Haritayı hazır bir native modül yerine kendimiz çiziyoruz: OpenStreetMap
 * karoları `expo-image` ile döşenir, işaretçiler ve rota SVG ile üstüne
 * konur. Nedeni pratik — `expo-maps` alfa ve Expo Go'da yok, `react-native-maps`
 * ise native derleme gerektirir; bu yaklaşım iOS, Android ve web'de tek kodla,
 * Expo Go'da doğrudan çalışır ve web uygulamasıyla aynı karo kaynağını kullanır.
 *
 * Karşılığında kaybedilen: sürükle/yakınlaştır. Takip ekranında harita zaten
 * ilgili noktalara otomatik oturuyor, o yüzden kabul edilebilir bir ödün.
 */

export const TILE_SIZE = 256;

export interface Point {
  x: number;
  y: number;
}

/** Enlem/boylamı verilen yakınlaştırmada dünya piksel düzlemine taşır. */
export function project(point: LatLng, zoom: number): Point {
  const scale = TILE_SIZE * 2 ** zoom;
  const lat = Math.max(-85.05112878, Math.min(85.05112878, point.lat));
  const sin = Math.sin((lat * Math.PI) / 180);

  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** Dünya pikselinden enlem/boylama geri döner. */
export function unproject(p: Point, zoom: number): LatLng {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (p.x / scale) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (p.y / scale);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

/** Noktaların ortasını bulur. */
export function centerOf(points: LatLng[]): LatLng {
  if (points.length === 0) return { lat: 0, lng: 0 };
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

/**
 * Verilen noktaların hepsinin görünür olduğu en yakın yakınlaştırmayı bulur.
 * Tek nokta varsa sokak seviyesine iner.
 */
export function fitZoom(
  points: LatLng[],
  width: number,
  height: number,
  padding = 28,
  maxZoom = 17,
  minZoom = 3
): number {
  if (points.length < 2) return 15;

  /*
   * Kenar payı kutunun kendisini yutmamalı. Sipariş kartındaki harita 150 px
   * yüksekliğinde; sabit bir pay burada görünür alanı neredeyse sıfırlayıp
   * haritayı gereksiz yere uzaklaştırıyordu. Bu yüzden pay uygulanırken
   * kutunun en az %60'ı korunuyor.
   */
  const usableW = Math.max(width * 0.6, width - padding * 2, 32);
  const usableH = Math.max(height * 0.6, height - padding * 2, 32);

  for (let zoom = maxZoom; zoom > minZoom; zoom -= 1) {
    const projected = points.map((p) => project(p, zoom));
    const xs = projected.map((p) => p.x);
    const ys = projected.map((p) => p.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    if (spanX <= usableW && spanY <= usableH) return zoom;
  }
  return minZoom;
}

export interface TileRef {
  x: number;
  y: number;
  z: number;
  /** Görünüm içindeki sol üst köşe konumu */
  left: number;
  top: number;
}

/**
 * Görünümü kaplayacak karoları listeler.
 *
 * Merkez noktası görünümün ortasına gelecek şekilde hesaplanır; kenarlarda
 * boşluk kalmasın diye her yönde bir karo fazla döşenir.
 */
export function tilesFor(
  center: LatLng,
  zoom: number,
  width: number,
  height: number
): TileRef[] {
  const scale = 2 ** zoom;
  const centerPx = project(center, zoom);

  // Görünümün sol üst köşesinin dünya pikseli
  const originX = centerPx.x - width / 2;
  const originY = centerPx.y - height / 2;

  const firstTileX = Math.floor(originX / TILE_SIZE);
  const firstTileY = Math.floor(originY / TILE_SIZE);
  const lastTileX = Math.floor((originX + width) / TILE_SIZE);
  const lastTileY = Math.floor((originY + height) / TILE_SIZE);

  const tiles: TileRef[] = [];
  for (let x = firstTileX; x <= lastTileX; x += 1) {
    for (let y = firstTileY; y <= lastTileY; y += 1) {
      // Kutup dışına çıkan karo yok; boylamda sarma var
      if (y < 0 || y >= scale) continue;
      tiles.push({
        x: ((x % scale) + scale) % scale,
        y,
        z: zoom,
        left: x * TILE_SIZE - originX,
        top: y * TILE_SIZE - originY,
      });
    }
  }
  return tiles;
}

/** Bir noktanın görünüm içindeki ekran konumu. */
export function screenPosition(
  point: LatLng,
  center: LatLng,
  zoom: number,
  width: number,
  height: number
): Point {
  const p = project(point, zoom);
  const c = project(center, zoom);
  return {
    x: p.x - c.x + width / 2,
    y: p.y - c.y + height / 2,
  };
}

/** OpenStreetMap karo adresi — web uygulamasındaki Leaflet ile aynı kaynak. */
export function tileUrl(tile: TileRef): string {
  const server = ["a", "b", "c"][(tile.x + tile.y) % 3];
  return `https://${server}.tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`;
}

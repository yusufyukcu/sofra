"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { BRAND_COLORS, projectOnPath, remainingPath } from "@sofra/core";
import type { LatLng, RouteLeg } from "@/lib/types";
import { distanceKm } from "@/lib/utils";
import { pinSvg, type PinIconName } from "./pin-icons";

/**
 * Leaflet tabanlı haritalar (yalnızca istemcide çalışır).
 *
 * Altlık olarak OpenStreetMap kullanılıyor: anahtar gerektirmez.
 * Üretimde Google Maps / Mapbox'a geçilmek istenirse yalnızca bu dosyadaki
 * `TileLayer` ve ikon üretimi değişir.
 */

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const BRAND = BRAND_COLORS.red;
const RESTAURANT_TONE = BRAND_COLORS.deep;

/** Yuvarlak, beyaz çerçeveli, ortasında ikon taşıyan işaretçi. */
function pinIcon(icon: PinIconName, tone: string = BRAND, pulse = false) {
  return L.divIcon({
    className: "sofra-pin",
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px">
        ${
          pulse
            ? `<span style="position:absolute;inset:4px;border-radius:9999px;background:${tone};opacity:.35" class="animate-pulse-ring"></span>`
            : ""
        }
        <span style="position:relative;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;background:${tone};box-shadow:0 4px 12px rgba(0,0,0,.35);border:2.5px solid #fff">${pinSvg(icon, 18)}</span>
      </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

/* ------------------------------------------------------------------ */
/* Adres seçici                                                        */
/* ------------------------------------------------------------------ */

function CenterWatcher({ onMove }: { onMove: (p: LatLng) => void }) {
  const map = useMapEvents({
    moveend() {
      const c = map.getCenter();
      onMove({ lat: c.lat, lng: c.lng });
    },
  });
  return null;
}

function Recenter({ point, zoom }: { point: LatLng; zoom?: number }) {
  const map = useMap();
  const last = useRef<string>("");
  useEffect(() => {
    const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
    if (last.current === key) return;
    last.current = key;
    map.setView([point.lat, point.lng], zoom ?? map.getZoom(), {
      animate: true,
    });
  }, [map, point, zoom]);
  return null;
}

/**
 * Pin ile adres seçimi: harita hareket eder, pin ortada sabit durur.
 * Mobil dokunmatik kullanımda sürüklenebilir işaretçiden daha kolaydır.
 */
export function PickerMap({
  value,
  onChange,
  className,
}: {
  value: LatLng;
  onChange: (p: LatLng) => void;
  className?: string;
}) {
  return (
    <div className={className} style={{ position: "relative" }}>
      <MapContainer
        center={[value.lat, value.lng]}
        zoom={16}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <CenterWatcher onMove={onChange} />
        <Recenter point={value} />
      </MapContainer>

      {/* Sabit merkez pini — ucu tam merkezde */}
      <svg
        aria-hidden
        width="40"
        height="50"
        viewBox="0 0 40 50"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -100%)",
          pointerEvents: "none",
          zIndex: 400,
          filter: "drop-shadow(0 6px 8px rgba(0,0,0,.35))",
        }}
      >
        <path
          d="M20 48.5C18.6 48.5 3 31.8 3 19.5a17 17 0 0 1 34 0C37 31.8 21.4 48.5 20 48.5z"
          fill={BRAND}
          stroke="#fff"
          strokeWidth="3"
        />
        <circle cx="20" cy="19.5" r="6.5" fill="#fff" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sipariş takip haritası                                              */
/* ------------------------------------------------------------------ */

const COURIER_TONE = "#2563eb";
const STALE_TONE = "#94a3b8";
const ROUTE_ATTRIBUTION = `${TILE_ATTRIBUTION} · Yol: <a href="https://project-osrm.org">OSRM</a> · <a href="https://www.openstreetmap.org/fixthemap">Haritayı düzelt</a>`;

/** Bu kadar uzağa sıçrayan konum kaydırılmadan yerine konur (km) */
const GLIDE_MAX_JUMP_KM = 0.5;

/**
 * İşaretçiyi iki konum arasında yumuşakça kaydırır. Kurye konumu birkaç
 * saniyede bir geldiği için işaretçi zıplamaz, yolda akar.
 */
function useGlidingPoint(target: LatLng | undefined, durationMs = 2_400): LatLng | undefined {
  const [shown, setShown] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const from = current.current;
    const glide = Boolean(from && target && distanceKm(from, target) < GLIDE_MAX_JUMP_KM);
    const started = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const k = glide ? Math.min(1, (now - started) / durationMs) : 1;
      const point =
        glide && from && target
          ? { lat: from.lat + (target.lat - from.lat) * k, lng: from.lng + (target.lng - from.lng) * k }
          : target;
      current.current = point;
      setShown(point);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return shown;
}

/**
 * Haritayı ayağa göre çerçeveler (ayak değişince yeniden) ve kurye görünüm
 * dışına çıkarsa haritayı ona kaydırır.
 */
function FollowDelivery({
  frame,
  frameKey,
  courier,
}: {
  frame: LatLng[];
  frameKey: string;
  courier?: LatLng;
}) {
  const map = useMap();
  const framed = useRef<string | null>(null);

  useEffect(() => {
    if (framed.current === frameKey || frame.length === 0) return;
    framed.current = frameKey;
    map.fitBounds(
      frame.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [48, 48], maxZoom: 16 }
    );
  }, [map, frame, frameKey]);

  useEffect(() => {
    if (!courier) return;
    if (!map.getBounds().pad(-0.12).contains([courier.lat, courier.lng])) {
      map.panTo([courier.lat, courier.lng], { animate: true });
    }
  }, [map, courier]);

  return null;
}

/**
 * Kurye canlı takibi.
 *
 * Çizgi, yol tarifi servisinden gelen gerçek yoldur ve yalnızca kuryenin
 * önündeki kısmı çizilir: restorana giderken kurye → restoran, sonra
 * kurye → adres. Rota henüz yoksa (ya da yol tarifi kapalıysa) çizgi
 * çizilmez; uydurma bir hat yerine yalnızca işaretçiler kalır. Konumu bir
 * süredir gelmeyen kurye soluk gösterilir.
 */
export function TrackingMap({
  restaurant,
  destination,
  courier,
  route,
  leg,
  stale = false,
  className,
}: {
  restaurant: LatLng;
  destination: LatLng;
  /** Kuryenin canlı konumu (kurye atanmadıysa yok) */
  courier?: LatLng;
  /** Kuryenin şu anki ayağının yol çizgisi */
  route?: LatLng[] | null;
  /** Şu anki ayak: restorana gidiş ya da müşteriye götürüş */
  leg?: RouteLeg | null;
  /** Kurye konumu bir süredir gelmiyor */
  stale?: boolean;
  className?: string;
}) {
  const shownCourier = useGlidingPoint(courier);

  // Yalnızca kuryenin önündeki yol
  const ahead = useMemo(() => {
    if (!route || route.length < 2) return null;
    if (!shownCourier) return route;
    const projection = projectOnPath(route, shownCourier);
    return projection ? remainingPath(route, projection) : route;
  }, [route, shownCourier]);

  // Çerçeve ayak değişince kurulur; kuryenin her adımında değil
  const hasCourier = Boolean(courier);
  const frameKey = `${leg ?? "-"}:${hasCourier ? 1 : 0}`;
  const frame = useMemo(() => {
    if (!courier) return [restaurant, destination];
    return leg === "pickup" ? [courier, restaurant, destination] : [courier, destination];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey, restaurant, destination]);

  const restaurantIcon = useMemo(() => pinIcon("Store", RESTAURANT_TONE), []);
  const homeIcon = useMemo(() => pinIcon("House", BRAND), []);
  const courierIcon = useMemo(
    () => pinIcon("Bike", stale ? STALE_TONE : COURIER_TONE, !stale),
    [stale]
  );
  const positions = ahead?.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <div className={className}>
      <MapContainer
        center={[destination.lat, destination.lng]}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={ROUTE_ATTRIBUTION} />
        <FollowDelivery frame={frame} frameKey={frameKey} courier={courier} />

        {positions && (
          <>
            {/* Beyaz kontur: çizgi karoların üstünde okunur kalsın */}
            <Polyline
              positions={positions}
              pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.9, lineCap: "round", lineJoin: "round" }}
              interactive={false}
            />
            <Polyline
              positions={positions}
              pathOptions={{
                color: stale ? STALE_TONE : COURIER_TONE,
                weight: 5,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
              }}
              interactive={false}
            />
          </>
        )}

        <Circle
          center={[destination.lat, destination.lng]}
          radius={120}
          pathOptions={{
            color: BRAND,
            fillColor: BRAND,
            fillOpacity: 0.08,
            weight: 1,
          }}
        />

        <Marker position={[restaurant.lat, restaurant.lng]} icon={restaurantIcon} />
        <Marker position={[destination.lat, destination.lng]} icon={homeIcon} />
        {shownCourier && (
          <Marker
            position={[shownCourier.lat, shownCourier.lng]}
            icon={courierIcon}
            zIndexOffset={1000}
          />
        )}
      </MapContainer>
    </div>
  );
}

const ZONE_STYLE = {
  color: BRAND,
  fillColor: BRAND,
  fillOpacity: 0.07,
  weight: 1.5,
};

/**
 * Restoran konumunu ve teslimat bölgesini gösteren küçük harita. Çizilmiş
 * bölge (en az 3 köşe) varsa çember yerine o gösterilir.
 */
export function StaticMap({
  point,
  radiusKm,
  zone,
  className,
}: {
  point: LatLng;
  radiusKm?: number;
  zone?: LatLng[] | null;
  className?: string;
}) {
  const polygon = zone && zone.length >= 3 ? zone : null;
  return (
    <div className={className}>
      <MapContainer
        center={[point.lat, point.lng]}
        zoom={radiusKm && radiusKm > 6 ? 12 : 13}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {polygon ? (
          <>
            <Polygon positions={polygon.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={ZONE_STYLE} />
            <FitAll points={[point, ...polygon]} />
          </>
        ) : (
          radiusKm && (
            <Circle center={[point.lat, point.lng]} radius={radiusKm * 1000} pathOptions={ZONE_STYLE} />
          )
        )}
        <Marker position={[point.lat, point.lng]} icon={pinIcon("Store", BRAND)} />
      </MapContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Teslimat bölgesi çizimi (restoran paneli)                           */
/* ------------------------------------------------------------------ */

function vertexIcon(index: number) {
  return L.divIcon({
    className: "sofra-vertex",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;background:#fff;border:2px solid ${BRAND};box-shadow:0 2px 6px rgba(0,0,0,.3);font:800 10px/1 system-ui,sans-serif;color:${BRAND};cursor:grab">${index + 1}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function ZoneClicks({ onAdd }: { onAdd: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onAdd({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

/**
 * Poligon teslimat bölgesi düzenleyici: haritaya tıklayınca köşe eklenir,
 * köşe sürüklenerek taşınır, köşeye tıklanınca silinir. Köşeler sırayla
 * birleştirilir. Henüz bölge yoksa mevcut yarıçap soluk çemberle gösterilir.
 */
export function ZoneEditorMap({
  center,
  radiusKm,
  zone,
  onChange,
  className,
}: {
  center: LatLng;
  radiusKm: number;
  zone: LatLng[];
  onChange: (zone: LatLng[]) => void;
  className?: string;
}) {
  const positions = zone.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <div className={className}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={radiusKm > 6 ? 12 : 13}
        scrollWheelZoom
        doubleClickZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <ZoneClicks onAdd={(point) => onChange([...zone, point])} />

        {zone.length < 3 && (
          <Circle
            center={[center.lat, center.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ ...ZONE_STYLE, dashArray: "6 6", fillOpacity: 0.03 }}
            interactive={false}
          />
        )}
        {zone.length >= 3 && <Polygon positions={positions} pathOptions={{ ...ZONE_STYLE, fillOpacity: 0.12 }} interactive={false} />}
        {zone.length === 2 && <Polyline positions={positions} pathOptions={ZONE_STYLE} interactive={false} />}

        {zone.map((point, index) => (
          <Marker
            key={`${index}-${point.lat}-${point.lng}`}
            position={[point.lat, point.lng]}
            icon={vertexIcon(index)}
            draggable
            title="Taşımak için sürükle, silmek için tıkla"
            eventHandlers={{
              dragend(event) {
                const moved = (event.target as L.Marker).getLatLng();
                onChange(zone.map((p, i) => (i === index ? { lat: moved.lat, lng: moved.lng } : p)));
              },
              click() {
                onChange(zone.filter((_, i) => i !== index));
              },
            }}
          />
        ))}

        <Marker position={[center.lat, center.lng]} icon={pinIcon("Store", BRAND)} interactive={false} />
      </MapContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Canlı operasyon haritası (yönetici paneli)                          */
/* ------------------------------------------------------------------ */

export interface OpsMarker {
  id: string;
  point: LatLng;
  icon: PinIconName;
  /** İşaretçi rengi — durum bilgisini taşır */
  tone: string;
  label: string;
  pulse?: boolean;
}

function FitAll({ points }: { points: LatLng[] }) {
  const map = useMap();
  const signature = points
    .map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`)
    .join("|");

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    map.fitBounds(
      points.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [48, 48], maxZoom: 15 }
    );
    // Yalnızca nokta kümesi değiştiğinde yeniden çerçevele
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map]);

  return null;
}

/**
 * Tüm aktif siparişlerin ve çevrimiçi kuryelerin tek haritada görüntüsü.
 * İşaretçi rengi durumu taşır: geciken siparişler kırmızı, zamanında
 * olanlar marka rengi, boştaki kuryeler yeşil.
 */
export function OpsMap({
  markers,
  className,
}: {
  markers: OpsMarker[];
  className?: string;
}) {
  const points = useMemo(() => markers.map((m) => m.point), [markers]);

  return (
    <div className={className}>
      <MapContainer
        center={[40.9903, 29.0273]}
        zoom={13}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <FitAll points={points} />

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.point.lat, marker.point.lng]}
            icon={pinIcon(marker.icon, marker.tone, marker.pulse)}
            title={marker.label}
          />
        ))}
      </MapContainer>
    </div>
  );
}

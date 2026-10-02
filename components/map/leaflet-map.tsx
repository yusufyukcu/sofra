"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LatLng } from "@/lib/types";

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

/** Emoji tabanlı özel işaretçi. */
function pinIcon(emoji: string, tone = "#e2452b", pulse = false) {
  return L.divIcon({
    className: "sofra-pin",
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px">
        ${
          pulse
            ? `<span style="position:absolute;inset:4px;border-radius:9999px;background:${tone};opacity:.35" class="animate-pulse-ring"></span>`
            : ""
        }
        <span style="position:relative;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;background:${tone};box-shadow:0 4px 12px rgba(0,0,0,.35);font-size:18px;line-height:1;border:2px solid #fff">${emoji}</span>
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

      {/* Sabit merkez pini */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -100%)",
          pointerEvents: "none",
          zIndex: 400,
          fontSize: 38,
          filter: "drop-shadow(0 4px 6px rgba(0,0,0,.4))",
        }}
      >
        📍
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sipariş takip haritası                                              */
/* ------------------------------------------------------------------ */

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length < 2) return;
    done.current = true;
    map.fitBounds(
      points.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [56, 56], maxZoom: 16 }
    );
  }, [map, points]);
  return null;
}

/**
 * Kurye canlı takibi: restoran → müşteri rotası, kat edilen kısım dolu,
 * kalan kısım kesikli çizgiyle gösterilir.
 */
export function TrackingMap({
  restaurant,
  destination,
  courier,
  route = [],
  className,
  restaurantEmoji = "🏪",
}: {
  restaurant: LatLng;
  destination: LatLng;
  courier?: LatLng;
  route?: LatLng[];
  className?: string;
  restaurantEmoji?: string;
}) {
  const path = useMemo(
    () => (route.length ? route : [restaurant, destination]),
    [route, restaurant, destination]
  );

  // Kuryenin rota üzerindeki en yakın noktasını bul → geçilen/kalan ayrımı
  const splitIndex = useMemo(() => {
    if (!courier) return 0;
    let best = 0;
    let bestDist = Infinity;
    path.forEach((p, i) => {
      const d = (p.lat - courier.lat) ** 2 + (p.lng - courier.lng) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }, [courier, path]);

  const travelled = path.slice(0, splitIndex + 1);
  const remaining = path.slice(splitIndex);

  return (
    <div className={className}>
      <MapContainer
        center={[destination.lat, destination.lng]}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <FitBounds points={[restaurant, destination]} />

        {remaining.length > 1 && (
          <Polyline
            positions={remaining.map((p) => [p.lat, p.lng])}
            pathOptions={{
              color: "#94a3b8",
              weight: 4,
              dashArray: "8 10",
              opacity: 0.9,
            }}
          />
        )}
        {courier && travelled.length > 1 && (
          <Polyline
            positions={travelled.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: "#e2452b", weight: 5, opacity: 0.95 }}
          />
        )}

        <Circle
          center={[destination.lat, destination.lng]}
          radius={120}
          pathOptions={{
            color: "#e2452b",
            fillColor: "#e2452b",
            fillOpacity: 0.08,
            weight: 1,
          }}
        />

        <Marker
          position={[restaurant.lat, restaurant.lng]}
          icon={pinIcon(restaurantEmoji, "#f59e0b")}
        />
        <Marker
          position={[destination.lat, destination.lng]}
          icon={pinIcon("🏠", "#e2452b")}
        />
        {courier && (
          <Marker
            position={[courier.lat, courier.lng]}
            icon={pinIcon("🛵", "#2563eb", true)}
            zIndexOffset={1000}
          />
        )}
      </MapContainer>
    </div>
  );
}

/** Restoran konumunu ve teslimat yarıçapını gösteren küçük harita. */
export function StaticMap({
  point,
  radiusKm,
  emoji = "🏪",
  className,
}: {
  point: LatLng;
  radiusKm?: number;
  emoji?: string;
  className?: string;
}) {
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
        {radiusKm && (
          <Circle
            center={[point.lat, point.lng]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: "#e2452b",
              fillColor: "#e2452b",
              fillOpacity: 0.07,
              weight: 1.5,
            }}
          />
        )}
        <Marker position={[point.lat, point.lng]} icon={pinIcon(emoji, "#e2452b")} />
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
  emoji: string;
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
            icon={pinIcon(marker.emoji, marker.tone, marker.pulse)}
            title={marker.label}
          />
        ))}
      </MapContainer>
    </div>
  );
}

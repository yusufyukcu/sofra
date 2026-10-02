import type { LatLng } from "./types";

/**
 * Ters coğrafi kodlama (koordinat → açık adres).
 *
 * Anahtar gerektirmeyen OpenStreetMap Nominatim servisini kullanır.
 * Servise ulaşılamazsa sessizce `null` döner; kullanıcı adresi elle
 * doldurmaya devam edebilir. Üretimde Google Geocoding / HERE gibi bir
 * servisle değiştirilebilir — dönen sözleşme aynı kalır.
 */

export interface ReverseGeocodeResult {
  line1: string;
  district: string;
  city: string;
  neighbourhood?: string;
}

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  town?: string;
  city_district?: string;
  district?: string;
  city?: string;
  province?: string;
  state?: string;
}

export async function reverseGeocode(
  point: LatLng,
  signal?: AbortSignal
): Promise<ReverseGeocodeResult | null> {
  const url =
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2" +
    `&lat=${point.lat}&lon=${point.lng}&zoom=18&accept-language=tr`;

  try {
    const response = await fetch(url, { signal, headers: { accept: "application/json" } });
    if (!response.ok) return null;

    const data = (await response.json()) as { address?: NominatimAddress };
    const a = data.address;
    if (!a) return null;

    const street = a.road ?? a.pedestrian ?? "";
    const neighbourhood = a.neighbourhood ?? a.quarter ?? a.suburb ?? "";
    const district = a.city_district ?? a.district ?? a.town ?? a.suburb ?? "";
    const city = a.province ?? a.city ?? a.state ?? "";

    const line1 = [neighbourhood && `${neighbourhood} Mah.`, street, a.house_number]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      line1: line1 || street || neighbourhood,
      district: district || "",
      city: city || "",
      neighbourhood: neighbourhood || undefined,
    };
  } catch {
    return null;
  }
}

/** Tarayıcı konum izni ile mevcut konumu alır. */
export function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Tarayıcın konum servisini desteklemiyor."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const messages: Record<number, string> = {
          1: "Konum izni verilmedi. Tarayıcı ayarlarından izin verebilirsin.",
          2: "Konumun belirlenemedi.",
          3: "Konum isteği zaman aşımına uğradı.",
        };
        reject(new Error(messages[err.code] ?? "Konum alınamadı."));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

/** Sık kullanılan İstanbul semtleri — hızlı seçim için. */
export const QUICK_LOCATIONS: { name: string; point: LatLng }[] = [
  { name: "Kadıköy", point: { lat: 40.9903, lng: 29.0273 } },
  { name: "Moda", point: { lat: 40.9795, lng: 29.0262 } },
  { name: "Göztepe", point: { lat: 40.9748, lng: 29.0595 } },
  { name: "Kozyatağı", point: { lat: 40.969, lng: 29.099 } },
  { name: "Ataşehir", point: { lat: 40.9925, lng: 29.127 } },
  { name: "Üsküdar", point: { lat: 41.0225, lng: 29.015 } },
  { name: "Beşiktaş", point: { lat: 41.043, lng: 29.009 } },
  { name: "Şişli", point: { lat: 41.06, lng: 28.987 } },
];

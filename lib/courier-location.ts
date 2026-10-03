"use client";

import type { LatLng } from "./types";

/**
 * Kurye cihazının konumu (tarayıcı konum servisi).
 *
 * Mesaiye başlamak konum izni ister: sipariş en yakın kuryeye teklif
 * edildiği için konumu bilinmeyen kurye teklif alamaz.
 */

export type LocationProblem = "denied" | "unavailable";

export class CourierLocationError extends Error {
  constructor(public problem: LocationProblem) {
    super(
      problem === "denied"
        ? "Mesaiye başlamak için konum izni gerekli. Tarayıcının adres çubuğundaki konum simgesinden izin ver."
        : "Konumun alınamadı. Cihazın konum servislerini açıp tekrar dene."
    );
    this.name = "CourierLocationError";
  }
}

/** Anlık konum; izin yoksa ya da alınamazsa `CourierLocationError`. */
export function currentPosition(timeoutMs = 15_000): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new CourierLocationError("unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) =>
        reject(new CourierLocationError(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable")),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 }
    );
  });
}

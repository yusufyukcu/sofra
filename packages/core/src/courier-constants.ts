/**
 * Kurye uygulamasinin istemci tarafinda da ihtiyac duydugu sabitler.
 * `lib/services/courier.ts` node bagimliliklari tasidigi icin ayri modul.
 */

/** Teklifin kuryede kalma suresi (saniye) — "sure kisitli" kabul penceresi. */
export const OFFER_TTL_SECONDS = 45;

/** Konum bildirim araligi (ms) */
export const LOCATION_PING_MS = 3000;

/** Hedefe bu mesafenin altinda kalinca varmis sayilir (km) */
export const ARRIVAL_THRESHOLD_KM = 0.06;

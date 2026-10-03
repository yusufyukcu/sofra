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

/** Teslimat yokken (mesaide beklerken) konum bildirim aralığı (ms) */
export const IDLE_LOCATION_PING_MS = 15_000;

/**
 * Konum değişmese de gönderilen "buradayım" sinyali (ms). Sunucu konumu
 * 5 dakikadır gelmeyen kuryeye teklif göndermez, 15 dakikada mesaiden düşürür.
 */
export const PRESENCE_HEARTBEAT_MS = 60_000;

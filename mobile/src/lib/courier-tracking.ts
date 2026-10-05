import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { IDLE_LOCATION_PING_MS, LOCATION_PING_MS, type LatLng } from "@sofra/core";
import { courierApi } from "./api";
import { hydrateTokens, readSession } from "./token-store";

/**
 * Kurye konum paylaşımı.
 *
 * Mesai açıkken cihazın GPS'i sunucuya bildirilir (`POST /courier/location`):
 * müşterinin haritası, en yakın kurye seçimi ve yol rotası buradan beslenir.
 *
 * Geliştirme ve mağaza derlemesinde konum arka planda da akar: Android'de
 * "Sofra Kurye · mesaidesin" bildirimli bir ön plan servisi, iOS'ta konum
 * arka plan modu (durum çubuğunda mavi gösterge) çalışır. Kurye ekranı
 * kilitlese ya da navigasyon uygulamasına geçse de müşteri onu canlı görür.
 * "Her zaman izin ver" gerekmez: güncellemeler kurye mesaiyi açarken
 * (uygulama öndeyken) başladığı için "uygulamayı kullanırken" izni yeter.
 *
 * Expo Go arka plan konumunu desteklemez. Orada konum yalnızca uygulama
 * açıkken paylaşılır (ön plan izleyicisi); kurye ekranı bunu söyler ve
 * teslimat sürerken ekranı açık tutar.
 */

export const COURIER_LOCATION_TASK = "sofra-courier-location";

/** `background`: kilit ekranında da · `foreground`: yalnızca uygulama açıkken */
export type TrackingMode = "background" | "foreground";

/** Bu doğruluktan (m) kötü okuma, yakın zamanda iyi konum varsa gönderilmez */
const POOR_ACCURACY_M = 100;
const GOOD_FIX_TTL_MS = 30_000;

let activeDelivery = false;
let lastSentAt = 0;
let lastGoodFixAt = 0;
let lastPoint: LatLng | null = null;
let sending = false;
let watcher: Location.LocationSubscription | null = null;

/** Teslimattayken 3 sn'de, beklerken 15 sn'de bir gönderilir. */
export function setActiveDelivery(active: boolean): void {
  activeDelivery = active;
}

async function send(point: LatLng, force = false): Promise<void> {
  const now = Date.now();
  const interval = activeDelivery ? LOCATION_PING_MS : IDLE_LOCATION_PING_MS;
  if (sending || (!force && now - lastSentAt < interval)) return;
  sending = true;
  lastSentAt = now;
  try {
    // Uygulama kapalıyken yalnızca servis çalışıyorsa oturum diskten okunur
    if (!readSession("courier")) await hydrateTokens();
    await courierApi.post("/courier/location", { point });
  } catch {
    /* ağ yoksa sonraki konumda yeniden denenir */
  } finally {
    sending = false;
  }
}

function accept(location: Location.LocationObject): void {
  const now = Date.now();
  // Kapalı alanda GPS yüzlerce metre sapabilir: iyi konum yeniyse kötü okumayı atla
  if ((location.coords.accuracy ?? 0) > POOR_ACCURACY_M) {
    if (now - lastGoodFixAt < GOOD_FIX_TTL_MS) return;
  } else {
    lastGoodFixAt = now;
  }
  const point = { lat: location.coords.latitude, lng: location.coords.longitude };
  lastPoint = point;
  void send(point);
}

/*
 * Görev, modül yüklenirken tanımlanmalı: uygulama arka planda (ya da
 * kapalıyken servis tarafından) uyandırıldığında hiçbir ekran açılmaz.
 * Bu yüzden modül kök yerleşimde içe aktarılır.
 */
TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(
  COURIER_LOCATION_TASK,
  async ({ data, error }) => {
    const locations = data?.locations;
    if (error || !locations?.length) return;
    accept(locations[locations.length - 1]);
  }
);

async function backgroundAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false; // Expo Go
  try {
    return await TaskManager.isAvailableAsync();
  } catch {
    return false;
  }
}

function stopWatcher(): void {
  watcher?.remove();
  watcher = null;
}

/**
 * Konum paylaşımını başlatır (konum izni önceden alınmış olmalı). Arka plan
 * servisi kurulabiliyorsa onu, kurulamıyorsa ön plan izleyicisini kullanır.
 */
export async function startCourierTracking(): Promise<TrackingMode> {
  if (await backgroundAvailable()) {
    try {
      if (!(await Location.hasStartedLocationUpdatesAsync(COURIER_LOCATION_TASK))) {
        await Location.startLocationUpdatesAsync(COURIER_LOCATION_TASK, {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_PING_MS,
          distanceInterval: 0,
          pausesUpdatesAutomatically: false,
          activityType: Location.ActivityType.OtherNavigation,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: "Sofra Kurye · mesaidesin",
            notificationBody: "Konumun teslimat için paylaşılıyor. Mesaiyi kapatınca durur.",
            notificationColor: "#E2452B",
            killServiceOnDestroy: false,
          },
        });
      }
      stopWatcher();
      return "background";
    } catch (err) {
      console.warn("[sofra/konum] arka plan konumu açılamadı, ön plan izleyicisine geçiliyor:", err);
    }
  }

  if (!watcher) {
    watcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: LOCATION_PING_MS, distanceInterval: 5 },
      accept
    );
  }
  return "foreground";
}

/** Mesai kapanınca (ya da oturum düşünce) konum paylaşımı tamamen durur. */
export async function stopCourierTracking(): Promise<void> {
  stopWatcher();
  if (Platform.OS === "web") return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(COURIER_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(COURIER_LOCATION_TASK);
    }
  } catch {
    /* görev hiç başlamadıysa ya da bu derlemede yoksa */
  }
}

/** Mesai açılırken alınan ilk konum (izleyici ilk okumayı verene kadar). */
export function rememberPoint(point: LatLng): void {
  lastPoint = point;
}

/**
 * "Buradayım" sinyali: kurye dururken konum olayı seyrekleşir; sunucu konumu
 * 5 dk gelmeyen kuryeye teklif göndermez, 15 dk'da mesaiden düşürür.
 */
export function sendPresence(): void {
  if (lastPoint) void send(lastPoint, true);
}

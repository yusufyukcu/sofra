"use client";

import { Bike, MapPinOff, Radio } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { useRealtime } from "@/lib/realtime";
import {
  IDLE_LOCATION_PING_MS,
  LOCATION_PING_MS,
  PRESENCE_HEARTBEAT_MS,
} from "@/lib/courier-constants";
import { useCourier, type PublicCourier } from "@/lib/store/courier";
import type { LatLng } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/primitives";
import { ActiveDelivery } from "./active-delivery";
import { OfferCard } from "./offer-card";

/** Bu doğruluktan (m) kötü okuma, yakın zamanda iyi konum varsa gönderilmez */
const POOR_ACCURACY_M = 100;
const GOOD_FIX_TTL_MS = 30_000;

/**
 * Kurye ana ekranı.
 *
 * Pano kuryenin Realtime kanalındaki teklif/sipariş olaylarıyla tazelenir;
 * yeni teklif tarayıcıda saniye saniye geri sayar.
 *
 * Mesaideyken cihazın gerçek konumu paylaşılır (`POST /courier/location`):
 * teslimatta 3 sn'de, beklerken 15 sn'de bir; konum değişmese de dakikada
 * bir "buradayım" sinyali gider. Sunucu konumu 5 dakikadır gelmeyen kuryeye
 * teklif göndermez — en yakın kurye seçimi bu konuma göre yapılır ve
 * müşterinin takip haritası buradan beslenir.
 *
 * Kapalı alanda GPS bazen yüzlerce metre sapan okuma verir: yakın zamanda
 * iyi bir konum varsa kötü okuma yok sayılır, işaretçi binaların üstüne
 * sıçramaz. Tarayıcı arka plandaki sekmenin konumunu göndermediği için
 * sayfa yeniden görünür olunca son konum hemen gönderilir.
 */
export function CourierOperations() {
  const courier = useCourier((s) => s.courier);
  const stats = useCourier((s) => s.stats);
  const offer = useCourier((s) => s.offer);
  const activeOrder = useCourier((s) => s.activeOrder);
  const applyBoard = useCourier((s) => s.applyBoard);
  const tickOffer = useCourier((s) => s.tickOffer);
  const setActivePoint = useCourier((s) => s.setActivePoint);

  const [loaded, setLoaded] = useState(false);

  /* ---------------- Canlı pano ---------------- */

  const refresh = useCallback(async () => {
    try {
      applyBoard(await api.get<Parameters<typeof applyBoard>[0]>("/courier/board"));
    } catch {
      /* geçici hata — sıradaki olayda ya da yoklamada düzelir */
    } finally {
      setLoaded(true);
    }
  }, [applyBoard]);

  const courierId = courier?.id;
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const status = useRealtime(
    "courier",
    courierId ? [`courier:${courierId}`] : [],
    (message) => {
      if (message.event === "courier_changed") {
        // Kendi konum bildirimlerimiz de bu olayı üretir: yalnızca vardiya ya da hesap durumu değişince tazele
        const current = useCourier.getState().courier;
        if (
          current &&
          message.payload.online === current.online &&
          message.payload.status === current.status
        ) {
          return;
        }
      } else if (message.event !== "offer_changed" && message.event !== "order_changed") {
        return;
      }
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => void refresh(), 200);
    },
    Boolean(courierId)
  );
  const live = status === "live";

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* Yedek yoklama: canlı bağlantıda seyrek, bağlantı yoksa sık */
  useEffect(() => {
    const timer = setInterval(() => void refresh(), live ? 20_000 : 4_000);
    return () => clearInterval(timer);
  }, [live, refresh]);

  /* Teklif geri sayımı; süre dolunca pano tazelenir ve teklif kalkar */
  const offerId = offer?.id;
  useEffect(() => {
    if (!offerId) return;
    const timer = setInterval(() => {
      tickOffer();
      if (useCourier.getState().offer?.secondsLeft === 0) void refresh();
    }, 1000);
    return () => clearInterval(timer);
  }, [offerId, tickOffer, refresh]);

  /* ---------------- Konum paylaşımı (mesaideyken) ---------------- */

  const [location, setLocation] = useState<"waiting" | "ok" | "denied" | "unavailable">("waiting");
  const sending = useRef(false);
  const lastSentAt = useRef(0);
  const lastPoint = useRef<LatLng | null>(null);
  const lastGoodFixAt = useRef(0);

  const pushLocation = useCallback(async (point: LatLng, force = false) => {
    const interval = useCourier.getState().activeOrder ? LOCATION_PING_MS : IDLE_LOCATION_PING_MS;
    if (sending.current || (!force && Date.now() - lastSentAt.current < interval)) return;
    sending.current = true;
    lastSentAt.current = Date.now();
    try {
      await api.post<{ courier: PublicCourier }>("/courier/location", { point });
    } catch {
      /* geçici hata — bir sonraki bildirimde düzelir */
    } finally {
      sending.current = false;
    }
  }, []);

  const online = Boolean(courier?.online);
  useEffect(() => {
    if (!online) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocation("unavailable");
      return;
    }
    setLocation("waiting");

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (position.coords.accuracy > POOR_ACCURACY_M) {
          if (now - lastGoodFixAt.current < GOOD_FIX_TTL_MS) return;
        } else {
          lastGoodFixAt.current = now;
        }
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        lastPoint.current = point;
        setLocation("ok");
        setActivePoint(point);
        void pushLocation(point);
      },
      (error) => setLocation(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 }
    );
    // Kurye dururken konum olayı gelmez: varlık sinyali son konumu yeniden gönderir
    const heartbeat = setInterval(() => {
      if (lastPoint.current) void pushLocation(lastPoint.current, true);
    }, PRESENCE_HEARTBEAT_MS);
    // Arka plandan dönünce beklemeden "buradayım"
    const onVisible = () => {
      if (document.visibilityState === "visible" && lastPoint.current) {
        void pushLocation(lastPoint.current, true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [online, setActivePoint, pushLocation]);

  /* ---------------- Görünüm ---------------- */

  if (!courier || !loaded) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {online && (location === "denied" || location === "unavailable") && (
        <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4">
          <MapPinOff className="mt-0.5 size-5 shrink-0 text-danger" />
          <div className="text-sm">
            <p className="font-bold text-ink">Konumun paylaşılamıyor</p>
            <p className="mt-0.5 text-muted">
              {location === "denied"
                ? "Tarayıcı konum iznini engelledi. Adres çubuğundaki konum simgesinden izin ver; konumu bilinmeyen kuryeye sipariş teklif edilmez."
                : "Konumun alınamıyor. Cihazın konum servislerini açıp sayfayı yenile; konumu bilinmeyen kuryeye sipariş teklif edilmez."}
            </p>
          </div>
        </div>
      )}

      {/* Günün özeti */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Bugün" value={formatPrice(stats.todayEarnings)} />
          <Stat label="Teslimat" value={String(stats.todayDeliveries)} />
          <Stat label="Bahşiş" value={formatPrice(stats.todayTips)} />
        </div>
      )}

      {offer && <OfferCard offer={offer} />}

      {activeOrder && !offer && <ActiveDelivery order={activeOrder} />}

      {!offer && !activeOrder && (
        <IdleState online={courier.online} live={live} locationOk={location === "ok"} />
      )}


    </div>
  );
}

/* ------------------------------------------------------------------ */

function IdleState({ online, live, locationOk }: { online: boolean; live: boolean; locationOk: boolean }) {
  if (!online) {
    return (
      <div className="card flex flex-col items-center px-6 py-12 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-muted" aria-hidden>
          <Bike className="size-8" strokeWidth={1.8} />
        </span>
        <h2 className="font-display mt-4 text-lg font-extrabold text-ink">
          Mesai kapalı
        </h2>
        <p className="mt-1.5 max-w-xs text-sm text-muted">
          Sipariş alabilmek için yukarıdaki anahtardan mesaiyi başlat. Vardiya
          açıkken yakındaki siparişler sana gönderilir.
        </p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="relative flex size-16 items-center justify-center">
        <span className="animate-pulse-ring absolute inset-0 rounded-full bg-pistachio/40" />
        <span className="relative flex size-16 items-center justify-center rounded-full bg-pistachio-soft text-pistachio">
          <Radio className="size-7" strokeWidth={1.9} aria-hidden />
        </span>
      </span>
      <h2 className="font-display mt-4 text-lg font-extrabold text-ink">
        Sipariş bekleniyor
      </h2>
      <p className="mt-1.5 max-w-xs text-sm text-muted">
        Yakınında bir sipariş hazırlanmaya başladığında teklif buraya düşecek.
        Kabul etmek için 45 saniyen olacak.
      </p>
      <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Radio
          className={cn("size-3.5", live ? "animate-pulse text-pistachio" : "")}
        />
        {live ? "Canlı bağlantı açık" : "Bağlantı kuruluyor…"}
        {" · "}
        {locationOk ? "Konumun paylaşılıyor" : "Konum bekleniyor…"}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-3 py-2.5 text-center">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className="font-display tabular mt-0.5 text-base font-extrabold text-ink">
        {value}
      </p>
    </div>
  );
}

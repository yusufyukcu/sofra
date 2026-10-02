"use client";

import { Crosshair, Radio, Satellite } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { useRealtime } from "@/lib/realtime";
import {
  ARRIVAL_THRESHOLD_KM,
  LOCATION_PING_MS,
} from "@/lib/courier-constants";
import { useCourier, type PublicCourier } from "@/lib/store/courier";
import type { LatLng } from "@/lib/types";
import { cn, distanceKm, formatPrice, lerpPoint } from "@/lib/utils";
import { Skeleton } from "@/components/ui/primitives";
import { ActiveDelivery } from "./active-delivery";
import { OfferCard } from "./offer-card";

/**
 * Kurye ana ekranı.
 *
 * Pano kuryenin Realtime kanalındaki teklif/sipariş olaylarıyla tazelenir;
 * yeni teklif tarayıcıda saniye saniye geri sayar.
 * Konum bildirimi iki kaynaktan gelebilir:
 *   simulated → kurye rota üzerinde ilerletilir (cihaz GPS'inin yerine geçer)
 *   device    → tarayıcının konum servisi
 * Her iki durumda da konum `POST /courier/location` ile sunucuya yazılır ve
 * müşterinin takip haritasını besler.
 */
export function CourierOperations() {
  const courier = useCourier((s) => s.courier);
  const stats = useCourier((s) => s.stats);
  const offer = useCourier((s) => s.offer);
  const activeOrder = useCourier((s) => s.activeOrder);
  const applyBoard = useCourier((s) => s.applyBoard);
  const locationSource = useCourier((s) => s.locationSource);
  const setLocationSource = useCourier((s) => s.setLocationSource);
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

  /* ---------------- Konum bildirimi ---------------- */

  const sending = useRef(false);
  const lastSent = useRef<LatLng | null>(null);

  const pushLocation = useCallback(async (point: LatLng) => {
    if (sending.current) return;
    sending.current = true;
    try {
      await api.post<{ courier: PublicCourier }>("/courier/location", { point });
      lastSent.current = point;
    } catch {
      /* geçici hata — bir sonraki bildirimde düzelir */
    } finally {
      sending.current = false;
    }
  }, []);

  /*
   * Simüle edilen sürüş: hedefe doğru kademeli ilerleme. Konum mağazada
   * tutulur ve her adımda hemen güncellenir; pano yeniden çekilmeden de
   * sürüş kesintisiz devam eder. Hedefe varınca bildirim durur.
   */
  const activeId = activeOrder?.id;
  const activeStage = activeOrder?.courierStage;
  useEffect(() => {
    if (locationSource !== "simulated" || !activeId) return;

    const timer = setInterval(() => {
      const { activeOrder: order, courier: me } = useCourier.getState();
      if (!order || !me) return;

      const target =
        order.courierStage === "picked_up" ? order.address.point : order.restaurantLocation;
      const current = order.courierPoint ?? me.point;
      if (current.lat === target.lat && current.lng === target.lng) {
        // Hedefteyiz: son nokta sunucuya ulaşmadıysa bir kez daha gönder
        const sent = lastSent.current;
        if (!sent || sent.lat !== target.lat || sent.lng !== target.lng) void pushLocation(target);
        return;
      }

      const next =
        distanceKm(current, target) <= ARRIVAL_THRESHOLD_KM
          ? target
          : lerpPoint(current, target, 0.16);
      setActivePoint(next);
      void pushLocation(next);
    }, LOCATION_PING_MS);

    return () => clearInterval(timer);
  }, [locationSource, activeId, activeStage, setActivePoint, pushLocation]);

  /* Cihaz konumu */
  useEffect(() => {
    if (locationSource !== "device") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setActivePoint(point);
        void pushLocation(point);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [locationSource, setActivePoint, pushLocation]);

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
        <IdleState online={courier.online} live={live} />
      )}

      {/* Konum kaynağı */}
      {activeOrder && (
        <div className="card p-3">
          <p className="mb-2 text-xs font-semibold text-muted">Konum kaynağı</p>
          <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {(
              [
                ["simulated", "Simüle sürüş", Satellite],
                ["device", "Cihaz konumu", Crosshair],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLocationSource(id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors",
                  locationSource === id
                    ? "bg-surface text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Prototipte cihaz GPS&apos;i yerine simüle sürüş kullanılır: konumun
            hedefe doğru ilerletilir ve müşterinin takip haritasına yansır.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function IdleState({ online, live }: { online: boolean; live: boolean }) {
  if (!online) {
    return (
      <div className="card flex flex-col items-center px-6 py-12 text-center">
        <span className="text-5xl" aria-hidden>
          🛵
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
        <span className="relative flex size-16 items-center justify-center rounded-full bg-pistachio-soft text-3xl">
          📡
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

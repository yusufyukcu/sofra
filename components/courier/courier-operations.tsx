"use client";

import { Crosshair, Radio, Satellite } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
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
 * Canlı pano SSE ile beslenir; yeni teklif saniye saniye geri sayar.
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

  const [live, setLive] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /* ---------------- Canlı pano ---------------- */

  const apply = useCallback(
    (payload: Parameters<typeof applyBoard>[0]) => {
      applyBoard(payload);
      setLoaded(true);
    },
    [applyBoard]
  );

  useEffect(() => {
    api
      .get<Parameters<typeof applyBoard>[0]>("/courier/board")
      .then(apply)
      .catch(() => setLoaded(true));

    const source = new EventSource("/api/v1/courier/board/stream", {
      withCredentials: true,
    });
    source.addEventListener("board", (event) => {
      try {
        apply(JSON.parse((event as MessageEvent).data));
        setLive(true);
      } catch {
        /* bozuk paket — yoksay */
      }
    });
    source.onerror = () => setLive(false);

    return () => source.close();
  }, [apply, applyBoard]);

  /* ---------------- Konum bildirimi ---------------- */

  const sending = useRef(false);

  const pushLocation = useCallback(async (point: LatLng) => {
    if (sending.current) return;
    sending.current = true;
    try {
      await api.post<{ courier: PublicCourier }>("/courier/location", { point });
    } catch {
      /* geçici hata — bir sonraki bildirimde düzelir */
    } finally {
      sending.current = false;
    }
  }, []);

  /* Simüle edilen sürüş: hedefe doğru kademeli ilerleme */
  useEffect(() => {
    if (locationSource !== "simulated") return;
    if (!activeOrder || !courier) return;

    const target =
      activeOrder.courierStage === "picked_up"
        ? activeOrder.address.point
        : activeOrder.restaurantLocation;

    const timer = setInterval(() => {
      const current = activeOrder.courierPoint ?? courier.point;
      const left = distanceKm(current, target);
      const next =
        left <= ARRIVAL_THRESHOLD_KM ? target : lerpPoint(current, target, 0.16);
      void pushLocation(next);
    }, LOCATION_PING_MS);

    return () => clearInterval(timer);
  }, [locationSource, activeOrder, courier, pushLocation]);

  /* Cihaz konumu */
  useEffect(() => {
    if (locationSource !== "device") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (position) =>
        void pushLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [locationSource, pushLocation]);

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

"use client";

import {
  Check,
  NotebookPen,
  Navigation,
  Package,
  Phone,
  Store,
  MapPin,
} from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useCourier } from "@/lib/store/courier";
import type { Order } from "@/lib/types";
import { cn, formatDistance, formatPrice, formatTime } from "@/lib/utils";
import { TrackingMap } from "@/components/map";
import { useToast } from "@/components/ui/toast";

/**
 * Açık teslimat ekranı.
 *
 * Aşama bildirimleri tek bir büyük birincil düğmeye indirgendi:
 * "Restorana vardım" → "Siparişi teslim aldım" → "Müşteriye teslim ettim".
 * Sürüş sırasında tek elle kullanılabilmesi için düğme 64 piksel yüksek.
 */

const STAGES = [
  { id: "assigned", label: "Restorana gidiyor" },
  { id: "at_restaurant", label: "Restoranda" },
  { id: "picked_up", label: "Müşteriye gidiyor" },
] as const;

const NEXT_ACTION = {
  assigned: { action: "arrived" as const, label: "Restorana vardım" },
  at_restaurant: { action: "pickup" as const, label: "Siparişi teslim aldım" },
  picked_up: { action: "deliver" as const, label: "Müşteriye teslim ettim" },
};

export function ActiveDelivery({ order }: { order: Order }) {
  const toast = useToast();
  const applyBoard = useCourier((s) => s.applyBoard);
  const courier = useCourier((s) => s.courier);
  const [busy, setBusy] = useState(false);

  const stage = (order.courierStage ?? "assigned") as keyof typeof NEXT_ACTION;
  const next = NEXT_ACTION[stage] ?? NEXT_ACTION.assigned;
  const heading = stage === "picked_up" ? "Teslimat" : "Alış";

  const target =
    stage === "picked_up" ? order.address.point : order.restaurantLocation;
  const remainingKm = courier
    ? Math.round(
        Math.hypot(
          (target.lat - courier.point.lat) * 111,
          (target.lng - courier.point.lng) * 85
        ) * 10
      ) / 10
    : 0;

  async function advance() {
    setBusy(true);
    try {
      const data = await api.post<Parameters<typeof applyBoard>[0]>(
        `/courier/orders/${order.id}`,
        { action: next.action }
      );
      applyBoard(data);

      const messages = {
        arrived: "Restorana vardığın bildirildi.",
        pickup: "Sipariş üzerinde. Müşteri artık seni haritada görüyor.",
        deliver: "Teslimat tamamlandı. Kazancın hesabına eklendi.",
      };
      toast.success(messages[next.action]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=driving`;

  return (
    <div className="space-y-4">
      {/* Aşama göstergesi */}
      <ol className="flex gap-1.5">
        {STAGES.map((item, index) => {
          const currentIndex = STAGES.findIndex((s) => s.id === stage);
          const done = index <= currentIndex;
          return (
            <li key={item.id} className="min-w-0 flex-1">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  done ? "bg-brand" : "bg-surface-3"
                )}
              />
              <p
                className={cn(
                  "mt-1.5 truncate text-[11px] font-semibold",
                  index === currentIndex ? "text-brand" : "text-muted"
                )}
              >
                {item.label}
              </p>
            </li>
          );
        })}
      </ol>

      {/* Harita */}
      <div className="card overflow-hidden">
        <TrackingMap
          restaurant={order.restaurantLocation}
          destination={order.address.point}
          courier={order.courierPoint ?? courier?.point}
          route={order.courierRoute}
          restaurantEmoji={order.restaurantEmoji}
          className="h-52 w-full"
        />

        <div className="flex items-center gap-3 border-t border-border p-4">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl text-xl",
              stage === "picked_up" ? "bg-brand-soft" : "bg-saffron-soft"
            )}
          >
            {stage === "picked_up" ? "🏠" : order.restaurantEmoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted">{heading}</p>
            <p className="truncate text-[15px] font-bold text-ink">
              {stage === "picked_up"
                ? `${order.address.title} · ${order.address.district}`
                : order.restaurantName}
            </p>
            <p className="tabular text-xs text-muted">
              {stage === "picked_up"
                ? order.address.line1
                : `${formatDistance(Math.max(remainingKm, 0))} uzaklıkta`}
            </p>
          </div>
          <a
            href={navUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Navigasyonu aç"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info transition-transform active:scale-95"
          >
            <Navigation className="size-5" />
          </a>
        </div>
      </div>

      {/* Adres ayrıntısı — teslimat aşamasında */}
      {stage === "picked_up" && (
        <div className="card space-y-2 p-4">
          <p className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-brand" />
            <span>
              <span className="block font-semibold text-ink">
                {order.address.line1}
              </span>
              <span className="tabular block text-xs text-muted">
                {[
                  order.address.buildingNo && `No ${order.address.buildingNo}`,
                  order.address.floor && `Kat ${order.address.floor}`,
                  order.address.apartmentNo && `Daire ${order.address.apartmentNo}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </p>

          {order.address.directions && (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs italic text-muted">
              {order.address.directions}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 pt-1">
            {order.preferences.contactless && (
              <Flag icon={<Package className="size-3" />}>Temassız</Flag>
            )}
            {!order.preferences.ringDoorbell && <Flag>🔕 Zile basma</Flag>}
            {order.preferences.note && <Flag>📝 Not var</Flag>}
          </div>

          {order.preferences.note && (
            <p className="flex items-start gap-1.5 rounded-lg bg-saffron-soft px-3 py-2 text-xs font-medium text-saffron">
              <NotebookPen className="mt-0.5 size-3 shrink-0" />
              {order.preferences.note}
            </p>
          )}

          {/* Maskeli arama */}
          <a
            href={`tel:${order.address.contactPhone ?? ""}`}
            className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 text-sm font-bold text-ink transition-colors hover:bg-surface-3"
          >
            <Phone className="size-4" />
            Müşteriyi ara · maskeli hat
          </a>
          <p className="text-center text-[11px] text-muted">
            Numaran müşteriye görünmez; görüşme platform hattı üzerinden yapılır.
          </p>
        </div>
      )}

      {/* Sipariş içeriği */}
      <section className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-2.5">
          <Store className="size-4 text-muted" />
          <span className="font-display tabular text-sm font-extrabold text-ink">
            {order.code}
          </span>
          <span className="tabular ml-auto text-sm font-bold text-ink">
            {formatPrice(order.courierFee ?? 0)}
          </span>
        </div>

        <ul className="divide-y divide-border">
          {order.lines.map((line) => (
            <li key={line.lineId} className="flex gap-3 px-4 py-2.5">
              <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-xs font-extrabold text-ink">
                {line.quantity}
              </span>
              <span className="min-w-0 flex-1 text-sm text-ink">
                {line.name}
              </span>
            </li>
          ))}
        </ul>

        <p className="tabular border-t border-border px-4 py-2.5 text-xs text-muted">
          {order.paymentLabel}
          {order.paymentLabel.includes("Kapıda") && (
            <span className="font-bold text-danger">
              {" "}
              · {formatPrice(order.totals.grandTotal)} tahsil et
            </span>
          )}
          {" · "}
          Tahmini teslim {formatTime(order.etaAt)}
        </p>
      </section>

      {/* Birincil aksiyon — sabit ve büyük */}
      <button
        type="button"
        disabled={busy}
        onClick={advance}
        className="flex h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-brand text-base font-extrabold text-brand-contrast shadow-brand transition-transform active:scale-[0.99] disabled:opacity-60"
      >
        <Check className="size-5" strokeWidth={3} />
        {next.label}
      </button>
    </div>
  );
}

function Flag({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
      {icon}
      {children}
    </span>
  );
}

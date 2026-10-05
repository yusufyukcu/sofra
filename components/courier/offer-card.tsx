"use client";

import { MapPin, Package, Store, Timer } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { OFFER_TTL_SECONDS } from "@/lib/courier-constants";
import type { ActiveOffer } from "@/lib/store/courier";
import { useCourier } from "@/lib/store/courier";
import { cn, formatDistance, formatPrice } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

/**
 * Atanan sipariş teklifi — süre kısıtlı.
 *
 * Kalan süre sunucudan saniye saniye gelir; süre dolduğunda sipariş
 * otomatik olarak sıradaki en yakın kuryeye geçer.
 */
export function OfferCard({ offer }: { offer: ActiveOffer }) {
  const toast = useToast();
  const applyBoard = useCourier((s) => s.applyBoard);
  const [busy, setBusy] = useState(false);

  const order = offer.order;
  const ratio = Math.max(0, Math.min(1, offer.secondsLeft / OFFER_TTL_SECONDS));
  const urgent = offer.secondsLeft <= 12;

  async function respond(action: "accept" | "reject") {
    setBusy(true);
    try {
      const data = await api.post<Parameters<typeof applyBoard>[0]>(
        `/courier/offers/${offer.id}`,
        { action }
      );
      applyBoard(data);
      toast.success(
        action === "accept"
          ? "Sipariş senin. Restorana doğru yola çıkabilirsin."
          : "Teklif reddedildi, sıradaki kuryeye gönderildi."
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const totalKm = Math.round((offer.pickupKm + offer.dropoffKm) * 10) / 10;

  return (
    <section className="card animate-fade-up overflow-hidden border-brand/50 shadow-soft">
      {/* Kalan süre */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2.5",
          urgent ? "bg-danger-soft" : "bg-brand-soft"
        )}
      >
        <Timer
          className={cn("size-4", urgent ? "text-danger" : "text-brand")}
        />
        <span
          className={cn(
            "text-sm font-extrabold",
            urgent ? "text-danger" : "text-brand"
          )}
        >
          Yeni sipariş
        </span>
        <span
          className={cn(
            "tabular ml-auto text-sm font-extrabold",
            urgent ? "text-danger" : "text-brand"
          )}
        >
          {offer.secondsLeft} sn
        </span>
      </div>
      <div className="h-1 bg-surface-3">
        <div
          className={cn(
            "h-full transition-[width] duration-1000 ease-linear",
            urgent ? "bg-danger" : "bg-brand"
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      <div className="p-4">
        {/* Kazanç önde */}
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted">Paket ücreti</p>
            <p className="font-display tabular text-3xl font-extrabold text-ink">
              {formatPrice(offer.fee)}
            </p>
          </div>
          <div className="tabular text-right text-sm text-muted">
            <p>{formatDistance(totalKm)} toplam</p>
            <p className="text-xs">{order.lines.length} kalem</p>
          </div>
        </div>

        {/* Alış → teslim */}
        <div className="mt-4 space-y-3">
          <Leg
            icon={<Store className="size-4" />}
            tone="saffron"
            title={order.restaurantName}
            subtitle={`Alış · ${formatDistance(offer.pickupKm)} uzaklıkta`}
          />
          <div className="ml-[1.125rem] h-4 w-px bg-border-strong" />
          <Leg
            icon={<MapPin className="size-4" />}
            tone="brand"
            title={`${order.address.district} · ${order.address.title}`}
            subtitle={`Teslim · ${formatDistance(offer.dropoffKm)} kuş uçuşu`}
          />
        </div>

        {order.preferences.contactless && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs font-medium text-muted">
            <Package className="size-3.5 shrink-0" aria-hidden />
            Temassız teslimat isteniyor
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => respond("reject")}
            className="h-14 flex-1 rounded-2xl border border-border bg-surface-2 text-[15px] font-bold text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            Reddet
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => respond("accept")}
            className="h-14 flex-[2] rounded-2xl bg-brand text-base font-extrabold text-brand-contrast shadow-brand transition-colors hover:bg-brand-hover active:scale-[0.99] disabled:opacity-50"
          >
            Siparişi al
          </button>
        </div>
      </div>
    </section>
  );
}

function Leg({
  icon,
  tone,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  tone: "saffron" | "brand";
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          tone === "saffron"
            ? "bg-saffron-soft text-saffron"
            : "bg-brand-soft text-brand"
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-ink">{title}</p>
        <p className="tabular text-xs text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

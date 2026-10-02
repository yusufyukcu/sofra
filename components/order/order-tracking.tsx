"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Bike,
  Check,
  Headset,
  MapPin,
  Phone,
  Radio,
  Star,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import {
  ADDRESS_LABELS,
  CANCELLABLE_STATUSES,
  CANCEL_REASONS,
  ORDER_FLOW,
  ORDER_STATUS_META,
} from "@/lib/constants";
import { useSession } from "@/lib/store/session";
import { useOrderStream } from "@/lib/use-order-stream";
import type { CourierStage, Order } from "@/lib/types";
import { cn, formatPrice, formatTime } from "@/lib/utils";
import { TrackingMap } from "@/components/map";
import { ChatPanel } from "@/components/support/chat-panel";
import { Modal } from "@/components/ui/modal";
import { Badge, Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { RestaurantThumb } from "@/components/ui/restaurant-thumb";
import { useToast } from "@/components/ui/toast";

/** Kuryenin bildirdiği aşamanın müşteriye gösterilen hâli. */
const COURIER_STAGE_LABEL: Partial<Record<CourierStage, string>> = {
  assigned: "Restorana gidiyor",
  at_restaurant: "Restoranda",
  picked_up: "Sana geliyor",
};

/** Sipariş takip ekranı — canlı durum, kurye haritası, iptal ve destek. */
export function OrderTracking({ orderId }: { orderId: string }) {
  const router = useRouter();
  const toast = useToast();
  const refreshActiveOrders = useSession((s) => s.refreshActiveOrders);
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const { order, progress, remainingMinutes, live, loading, error, setOrder } =
    useOrderStream(orderId);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [cancelling, setCancelling] = useState(false);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 pt-6 lg:px-6 lg:pt-8">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8 lg:px-6 lg:pt-12">
        <EmptyState
          emoji="🧾"
          title="Sipariş bulunamadı"
          description={error ?? "Bu siparişe erişim iznin yok veya silinmiş olabilir."}
          action={
            <Link href="/hesabim/siparislerim">
              <Button>Siparişlerime dön</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const meta = ORDER_STATUS_META[order.status];
  const cancelled = order.status === "cancelled";
  const delivered = order.status === "delivered";
  const canCancel = CANCELLABLE_STATUSES.includes(order.status);
  const showMap =
    order.courierMode === "platform" && !cancelled && Boolean(order.courierRoute);

  async function cancelOrder() {
    setCancelling(true);
    try {
      const data = await api.post<{ order: Order; refunded: number; walletBalance: number }>(
        `/orders/${orderId}/cancel`,
        { reason }
      );
      setOrder(data.order);
      if (user) setUser({ ...user, walletBalance: data.walletBalance });
      void refreshActiveOrders();
      toast.success(
        data.refunded > 0
          ? `Siparişin iptal edildi, ${formatPrice(data.refunded)} cüzdanına iade edildi.`
          : "Siparişin iptal edildi. Kapıda ödeme seçtiğin için tahsilat yapılmayacak."
      );
      setCancelOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 lg:px-6 lg:pt-8">
      <Link
        href="/hesabim/siparislerim"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" />
        Siparişlerim
      </Link>

      {/* Durum başlığı */}
      <header className="card overflow-hidden">
        <div
          className={cn(
            "flex items-center gap-4 p-5",
            cancelled ? "bg-danger-soft" : delivered ? "bg-success-soft" : "bg-brand-soft"
          )}
        >
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-surface text-2xl shadow-sm">
            {meta.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-text sm:text-2xl">
                {meta.label}
              </h1>
              {live && !delivered && !cancelled && (
                <Badge tone="info">
                  <Radio className="size-3 animate-pulse" />
                  Canlı
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted">{meta.description}</p>
          </div>
        </div>

        {!cancelled && (
          <div className="px-5 py-4">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted">
                {delivered ? "Teslim edildi" : "Tahmini teslim"}
              </span>
              <span className="text-lg font-extrabold text-text">
                {delivered && order.deliveredAt
                  ? formatTime(order.deliveredAt)
                  : `${formatTime(order.etaAt)} · ${remainingMinutes} dk`}
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
                style={{ width: `${Math.max(4, progress * 100)}%` }}
              />
            </div>

            <ol className="mt-5 grid grid-cols-4 gap-1">
              {ORDER_FLOW.map((step, i) => {
                const stepIndex = ORDER_FLOW.indexOf(order.status);
                const done = stepIndex >= i;
                const current = stepIndex === i;
                const entry = order.timeline.find((t) => t.status === step);
                return (
                  <li key={step} className="text-center">
                    <span
                      className={cn(
                        "relative mx-auto flex size-8 items-center justify-center rounded-full border-2 transition-colors",
                        done
                          ? "border-brand bg-brand text-brand-contrast"
                          : "border-border bg-surface text-muted"
                      )}
                    >
                      {current && !delivered && (
                        <span className="animate-pulse-ring absolute inset-0 rounded-full bg-brand" />
                      )}
                      {done ? (
                        <Check className="size-4" strokeWidth={3} />
                      ) : (
                        <span className="text-xs font-bold">{i + 1}</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "mt-1.5 block text-[11px] font-semibold leading-tight",
                        done ? "text-text" : "text-muted"
                      )}
                    >
                      {ORDER_STATUS_META[step].label}
                    </span>
                    {entry && (
                      <span className="block text-[10px] text-muted">
                        {formatTime(entry.at)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {cancelled && (
          <div className="px-5 py-4">
            <p className="text-sm text-muted">
              <span className="font-semibold text-text">İptal nedeni:</span>{" "}
              {order.cancelReason}
            </p>
            {order.cancelledAt && (
              <p className="mt-0.5 text-xs text-muted">
                {formatTime(order.cancelledAt)} itibarıyla iptal edildi.
              </p>
            )}
          </div>
        )}
      </header>

      {/* Kurye haritası */}
      {showMap && (
        <section className="card mt-4 overflow-hidden">
          <TrackingMap
            restaurant={order.restaurantLocation}
            destination={order.address.point}
            courier={order.status === "pending_approval" ? undefined : order.courierPoint}
            route={order.courierRoute}
            restaurantEmoji={order.restaurantEmoji}
            className="h-64 w-full sm:h-80"
          />

          {order.courier ? (
            <div className="flex items-center gap-3 border-t border-border p-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-2xl">
                {order.courier.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-bold text-text">
                  {order.courier.name}
                  <BadgeCheck className="size-4 text-info" />
                </p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  {order.courierStage && COURIER_STAGE_LABEL[order.courierStage] && (
                    <span className="rounded-md bg-info-soft px-1.5 py-0.5 font-semibold text-info">
                      {COURIER_STAGE_LABEL[order.courierStage]}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3 fill-accent text-accent" />
                    {order.courier.rating}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Bike className="size-3" />
                    {order.courier.vehicle === "moto"
                      ? "Motosiklet"
                      : order.courier.vehicle === "bisiklet"
                        ? "Bisiklet"
                        : "Araç"}
                  </span>
                </p>
              </div>
              <a
                href={`tel:${order.courier.maskedPhone.replace(/\s/g, "")}`}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-text transition-colors hover:bg-surface-2"
              >
                <Phone className="size-4" />
                Ara
              </a>
            </div>
          ) : (
            <p className="border-t border-border p-4 text-sm text-muted">
              {order.courierStage === "offered"
                ? "Yakındaki kuryelere gönderildi, biri üstlendiğinde burada görünecek."
                : "Siparişin hazırlandığında sana en yakın kurye atanacak."}
            </p>
          )}

          {order.courier && (
            <p className="border-t border-border bg-surface-2 px-4 py-2.5 text-xs text-muted">
              Numaran gizli: aramalar{" "}
              <span className="font-semibold text-text">
                {order.courier.maskedPhone}
              </span>{" "}
              maskeli hattı üzerinden yapılır.
            </p>
          )}
        </section>
      )}

      {order.courierMode === "vendor" && !cancelled && (
        <p className="card mt-4 p-4 text-sm text-muted">
          🚗 Bu siparişi{" "}
          <span className="font-semibold text-text">{order.restaurantName}</span>{" "}
          kendi kuryesiyle getiriyor, bu yüzden canlı harita takibi yok. Durum
          güncellemeleri restorandan anlık olarak iletilir.
        </p>
      )}

      {/* Teslim edildi → değerlendirme */}
      {delivered && !order.rating && (
        <section className="card mt-4 flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:text-left">
          <span className="text-3xl">⭐</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-text">Siparişin nasıldı?</p>
            <p className="text-sm text-muted">
              Restoranı ve kuryeni ayrı ayrı puanlayarak diğer kullanıcılara
              yardımcı ol.
            </p>
          </div>
          <Button onClick={() => router.push(`/siparis/${order.id}/degerlendir`)}>
            Değerlendir
          </Button>
        </section>
      )}

      {delivered && order.rating && (
        <section className="card mt-4 p-5">
          <p className="flex items-center gap-2 font-bold text-text">
            <Check className="size-5 text-success" />
            Değerlendirmen için teşekkürler
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
            <span>
              Restoran:{" "}
              <span className="font-semibold text-text">
                {order.rating.restaurantScore}/5
              </span>
            </span>
            {order.rating.courierScore && (
              <span>
                Kurye:{" "}
                <span className="font-semibold text-text">
                  {order.rating.courierScore}/5
                </span>
              </span>
            )}
            {order.rating.courierTip ? (
              <span>
                Bahşiş:{" "}
                <span className="font-semibold text-pistachio">
                  {formatPrice(order.rating.courierTip)}
                </span>
              </span>
            ) : null}
          </div>
        </section>
      )}

      {/* Sipariş detayı */}
      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <RestaurantThumb
            image={order.restaurantImage}
            emoji={order.restaurantEmoji}
            className="size-10 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <Link
              href={`/restoran/${order.restaurantSlug}`}
              className="block truncate font-bold text-text hover:text-brand"
            >
              {order.restaurantName}
            </Link>
            <p className="text-xs text-muted">
              {order.code} · {formatTime(order.createdAt)}
            </p>
          </div>
        </div>

        <ul className="divide-y divide-border">
          {order.lines.map((line) => (
            <li key={line.lineId} className="flex gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-sm font-bold text-muted">
                {line.quantity}×
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">{line.name}</p>
                {line.selections.map((s) => (
                  <p key={s.groupId} className="text-xs text-muted">
                    {s.groupName}: {s.optionNames.join(", ")}
                  </p>
                ))}
                {line.note && (
                  <p className="mt-1 text-xs italic text-muted">“{line.note}”</p>
                )}
              </div>
              <span className="shrink-0 text-sm font-bold text-text">
                {formatPrice(line.unitPrice * line.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t border-border p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Ara toplam</dt>
            <dd className="font-semibold">{formatPrice(order.totals.subtotal)}</dd>
          </div>
          {order.totals.discount > 0 && (
            <div className="flex justify-between text-success">
              <dt>İndirim {order.couponCode && `(${order.couponCode})`}</dt>
              <dd className="font-semibold">
                − {formatPrice(order.totals.discount)}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">Teslimat</dt>
            <dd className="font-semibold">
              {order.totals.deliveryFee === 0
                ? "Ücretsiz"
                : formatPrice(order.totals.deliveryFee)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Hizmet bedeli</dt>
            <dd className="font-semibold">{formatPrice(order.totals.serviceFee)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base">
            <dt className="font-bold">Toplam</dt>
            <dd className="font-extrabold">{formatPrice(order.totals.grandTotal)}</dd>
          </div>
          <div className="flex justify-between pt-1">
            <dt className="text-muted">Ödeme</dt>
            <dd className="font-semibold">{order.paymentLabel}</dd>
          </div>
        </dl>

        <div className="border-t border-border p-4">
          <p className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-brand" />
            <span>
              <span className="font-semibold text-text">
                {ADDRESS_LABELS.find((l) => l.id === order.address.label)?.emoji}{" "}
                {order.address.title}
              </span>
              <span className="block text-muted">{order.address.line1}</span>
              <span className="block text-xs text-muted">
                {order.address.district} / {order.address.city}
              </span>
            </span>
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {order.preferences.contactless && <Badge>📦 Temassız teslimat</Badge>}
            {order.preferences.ringDoorbell ? (
              <Badge>🔔 Zile bassın</Badge>
            ) : (
              <Badge>🔕 Zile basmasın</Badge>
            )}
            {order.preferences.cutlery && <Badge>🍴 Çatal-bıçak</Badge>}
          </div>

          {order.preferences.note && (
            <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs italic text-muted">
              Kurye notu: {order.preferences.note}
            </p>
          )}
        </div>
      </section>

      {/* Aksiyonlar */}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => setSupportOpen(true)}>
          <Headset className="size-4" />
          Canlı destek
        </Button>

        {canCancel && (
          <Button variant="outline" onClick={() => setCancelOpen(true)}>
            <XCircle className="size-4" />
            Siparişi iptal et
          </Button>
        )}

        {(delivered || cancelled) && (
          <Link href={`/restoran/${order.restaurantSlug}`}>
            <Button variant="secondary">Tekrar sipariş ver</Button>
          </Link>
        )}
      </div>

      {/* İptal diyaloğu */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Siparişi iptal et"
        description="İptal nedenini seçersen hizmetimizi geliştirmemize yardımcı olursun."
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" block onClick={() => setCancelOpen(false)}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              block
              loading={cancelling}
              onClick={cancelOrder}
            >
              İptal et
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          {CANCEL_REASONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setReason(item)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors",
                reason === item
                  ? "border-brand bg-brand-soft font-semibold"
                  : "border-border hover:bg-surface-2"
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full border-2",
                  reason === item ? "border-brand bg-brand" : "border-border-strong"
                )}
              />
              {item}
            </button>
          ))}
          <p className="pt-2 text-xs text-muted">
            Online ödemelerde tutar anında Sofra Cüzdan bakiyene iade edilir.
          </p>
        </div>
      </Modal>

      {/* Destek */}
      <Modal
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        title="Sofra Asistanı"
        description={`${order.code} numaralı siparişin hakkında yardımcı olabilirim.`}
        size="sm"
      >
        <ChatPanel orderId={order.id} className="h-[60dvh] sm:h-[420px]" />
      </Modal>
    </div>
  );
}

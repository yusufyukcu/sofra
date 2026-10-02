"use client";

import {
  BellOff,
  Clock,
  MapPin,
  NotebookPen,
  Package,
  Phone,
  Utensils,
} from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { ORDER_STATUS_META, PAYMENT_METHODS } from "@/lib/constants";
import { useVendor } from "@/lib/store/vendor";
import type { Order } from "@/lib/types";
import { cn, formatPrice, formatTime, relativeTime } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { REJECT_REASONS } from "./reject-reasons";

const PREP_OPTIONS = [10, 15, 20, 30, 45, 60];

/** Kuryenin bildirdiği aşamanın restorana gösterilen hâli. */
const COURIER_STAGE_LABEL: Record<string, string> = {
  offered: "Kurye aranıyor",
  assigned: "Restorana geliyor",
  at_restaurant: "Restoranda bekliyor",
  picked_up: "Siparişi aldı",
};

/**
 * Sipariş fişi.
 *
 * Mutfakta okunacak şekilde tasarlandı: adet ve ürün adı en büyük
 * tipografi, seçenekler ve not hemen altında, para ve adres en sonda.
 * Aksiyonlar siparişin durumuna göre değişir.
 */
export function OrderTicket({
  order,
  onChanged,
}: {
  order: Order;
  onChanged: () => void;
}) {
  const toast = useToast();
  const setSummary = useVendor((s) => s.setSummary);

  const [prep, setPrep] = useState(order.prepMinutes ?? 20);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [customReason, setCustomReason] = useState("");

  const meta = ORDER_STATUS_META[order.status];
  const courierAssigned =
    order.courierStage === "assigned" || order.courierStage === "at_restaurant";
  const pending = order.status === "pending_approval";
  const preparing = order.status === "preparing";
  const onTheWay = order.status === "on_the_way";
  const closed = order.status === "delivered" || order.status === "cancelled";

  const ownCourier = order.courierMode === "vendor";
  const paidOnDelivery = PAYMENT_METHODS[order.paymentMethod].onDelivery;

  async function act(
    action: "approve" | "prep-time" | "ready" | "dispatch" | "deliver" | "reject",
    extra: Record<string, unknown> = {}
  ) {
    setBusy(true);
    try {
      const data = await api.post<{
        order: Order;
        summary: Parameters<typeof setSummary>[0];
      }>(`/vendor/orders/${order.id}`, { action, ...extra });
      setSummary(data.summary);
      onChanged();

      const messages: Record<typeof action, string> = {
        approve: `${order.code} onaylandı · ${prep} dk`,
        "prep-time": `${order.code} süresi ${prep} dakikaya güncellendi`,
        ready: `${order.code} hazır olarak işaretlendi`,
        dispatch: `${order.code} yola çıktı`,
        deliver: `${order.code} teslim edildi`,
        reject: paidOnDelivery
          ? `${order.code} reddedildi`
          : `${order.code} reddedildi, tutar müşteriye iade edildi`,
      };
      toast.success(messages[action]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const itemCount = order.lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <article
      className={cn(
        "card overflow-hidden",
        pending && "border-brand/45 shadow-soft"
      )}
    >
      {/* Başlık şeridi */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2.5",
          pending
            ? "bg-brand-soft"
            : preparing
              ? "bg-saffron-soft"
              : onTheWay
                ? "bg-info-soft"
                : "bg-surface-2"
        )}
      >
        <span className="font-display tabular text-base font-extrabold text-ink">
          {order.code}
        </span>
        <span className="text-xs text-muted">{relativeTime(order.createdAt)}</span>
        <span className="ml-auto text-xs font-bold text-muted">
          {meta.emoji} {meta.label}
        </span>
      </div>

      {/* Ürünler */}
      <ul className="divide-y divide-border">
        {order.lines.map((line) => (
          <li key={line.lineId} className="flex gap-3 px-4 py-3">
            <span className="font-display tabular flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink text-sm font-extrabold text-paper">
              {line.quantity}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold leading-tight text-ink">
                {line.name}
              </p>
              {line.selections.map((selection) => (
                <p key={selection.groupId} className="mt-0.5 text-xs text-muted">
                  <span className="font-semibold">{selection.groupName}:</span>{" "}
                  {selection.optionNames.join(", ")}
                </p>
              ))}
              {line.note && (
                <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-saffron-soft px-2 py-1.5 text-xs font-medium text-saffron">
                  <NotebookPen className="mt-0.5 size-3 shrink-0" />
                  {line.note}
                </p>
              )}
            </div>
            <span className="tabular shrink-0 text-sm font-bold text-ink">
              {formatPrice(line.unitPrice * line.quantity)}
            </span>
          </li>
        ))}
      </ul>

      {/* Özet */}
      <div className="space-y-2 border-t border-border bg-surface-2/60 px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">
            {itemCount} ürün · {order.paymentLabel}
          </span>
          <span className="tabular font-extrabold text-ink">
            {formatPrice(order.totals.grandTotal)}
          </span>
        </div>

        <p className="flex items-start gap-1.5 text-xs text-muted">
          <MapPin className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {order.address.district} ·{" "}
            {[
              order.address.buildingNo && `No ${order.address.buildingNo}`,
              order.address.floor && `Kat ${order.address.floor}`,
              order.address.apartmentNo && `D ${order.address.apartmentNo}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </p>

        <div className="flex flex-wrap gap-1.5">
          {order.preferences.contactless && (
            <Flag icon={<Package className="size-3" />}>Temassız</Flag>
          )}
          {!order.preferences.ringDoorbell && (
            <Flag icon={<BellOff className="size-3" />}>Zile basma</Flag>
          )}
          {order.preferences.cutlery && (
            <Flag icon={<Utensils className="size-3" />}>Çatal-bıçak</Flag>
          )}
          {order.courier && (
            <Flag icon={<Phone className="size-3" />}>
              {order.courier.name}
            </Flag>
          )}
        </div>

        {order.preferences.note && (
          <p className="rounded-lg bg-surface px-2.5 py-2 text-xs italic text-muted">
            Kurye notu: {order.preferences.note}
          </p>
        )}
      </div>

      {/* Aksiyonlar */}
      {pending && (
        <div className="space-y-3 border-t border-border p-4">
          <div>
            <p className="mb-2 text-xs font-bold text-ink">
              Hazırlık süresi
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PREP_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setPrep(minutes)}
                  className={cn(
                    "tabular rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors",
                    prep === minutes
                      ? "border-brand bg-brand text-brand-contrast"
                      : "border-border bg-surface text-ink hover:bg-surface-2"
                  )}
                >
                  {minutes} dk
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setRejectOpen(true)}
              disabled={busy}
            >
              Reddet
            </Button>
            <Button
              block
              size="lg"
              loading={busy}
              onClick={() => act("approve", { prepMinutes: prep })}
            >
              Onayla · {prep} dk
            </Button>
          </div>
        </div>
      )}

      {preparing && (
        <div className="space-y-3 border-t border-border p-4">
          <div className="tabular flex items-center gap-2 text-sm text-muted">
            <Clock className="size-4" />
            Tahmini çıkış {formatTime(order.etaAt)} · {order.prepMinutes ?? 20} dk
            bildirildi
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PREP_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                disabled={busy}
                onClick={() => {
                  setPrep(minutes);
                  void act("prep-time", { prepMinutes: minutes });
                }}
                className="tabular rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:border-border-strong hover:text-ink disabled:opacity-50"
              >
                +{minutes} dk
              </button>
            ))}
          </div>
          {/* Platform kuryesi üstlendiyse "Yolda" bildirimini kurye yapar */}
          {courierAssigned && order.courier ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 rounded-xl border border-info/30 bg-info-soft px-3 py-2.5">
                <span className="text-lg">{order.courier.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">
                    {order.courier.name}
                  </span>
                  <span className="block text-xs text-info">
                    {COURIER_STAGE_LABEL[order.courierStage ?? "assigned"]}
                  </span>
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRejectOpen(true)}
                  disabled={busy}
                >
                  İptal
                </Button>
                <Button
                  block
                  size="lg"
                  variant={order.readyAt ? "secondary" : "success"}
                  loading={busy}
                  disabled={Boolean(order.readyAt)}
                  onClick={() => act("ready")}
                >
                  {order.readyAt ? "Hazır · kurye bekleniyor" : "Sipariş hazır"}
                </Button>
              </div>
            </div>
          ) : ownCourier ? (
            /* Restoran kendi kuryesiyle götürüyor: yola çıkışı panel bildirir */
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={busy}>
                İptal
              </Button>
              <Button block size="lg" variant="success" loading={busy} onClick={() => act("dispatch")}>
                Yola çıktı
              </Button>
            </div>
          ) : (
            /* Platform kuryesi aranıyor: "Yolda" geçişini kurye yapacak */
            <div className="space-y-2.5">
              <p className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-xs text-muted">
                {order.courierStage === "offered"
                  ? "Yakındaki bir kuryeye teklif gönderildi, yanıtı bekleniyor."
                  : "Platform kuryesi aranıyor. Kurye atanınca burada görünecek."}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={busy}>
                  İptal
                </Button>
                <Button
                  block
                  size="lg"
                  variant={order.readyAt ? "secondary" : "success"}
                  loading={busy}
                  disabled={Boolean(order.readyAt)}
                  onClick={() => act("ready")}
                >
                  {order.readyAt ? "Hazır · kurye bekleniyor" : "Sipariş hazır"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {onTheWay && (
        <div className="space-y-2.5 border-t border-border px-4 py-3">
          <p className="tabular text-sm text-muted">
            <Clock className="mr-1.5 inline size-4" />
            Tahmini teslim {formatTime(order.etaAt)}
            {order.courier
              ? ` · ${order.courier.name}`
              : ownCourier
                ? " · restoran kuryesinde"
                : " · platform kuryesinde"}
          </p>
          {ownCourier && (
            <Button block variant="success" loading={busy} onClick={() => act("deliver")}>
              Teslim edildi
            </Button>
          )}
        </div>
      )}

      {closed && order.status === "cancelled" && (
        <p className="border-t border-border bg-danger-soft px-4 py-3 text-sm text-danger">
          {order.cancelReason}
          {order.cancelledBy === "vendor" && " (restoran reddetti)"}
        </p>
      )}

      {/* Reddetme */}
      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={`${order.code} siparişini reddet`}
        description="Müşteriye neden bildirilecek. Online ödemelerde tutar anında iade edilir."
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" block onClick={() => setRejectOpen(false)}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              block
              loading={busy}
              onClick={() => {
                void act("reject", {
                  reason: customReason.trim() || reason,
                });
                setRejectOpen(false);
              }}
            >
              Reddet
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          {REJECT_REASONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setReason(item);
                setCustomReason("");
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors",
                reason === item && !customReason
                  ? "border-brand bg-brand-soft font-semibold"
                  : "border-border hover:bg-surface-2"
              )}
            >
              <span
                className={cn(
                  "size-4 shrink-0 rounded-full border-2",
                  reason === item && !customReason
                    ? "border-brand bg-brand"
                    : "border-border-strong"
                )}
              />
              {item}
            </button>
          ))}
          <Textarea
            rows={2}
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Başka bir neden yaz…"
            maxLength={160}
            className="mt-2"
          />
        </div>
      </Modal>
    </article>
  );
}

function Flag({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-muted">
      {icon}
      {children}
    </span>
  );
}

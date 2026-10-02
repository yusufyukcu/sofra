"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { Order } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button, Field, Input, Textarea } from "@/components/ui/primitives";

export type OrderActionKind = "cancel" | "refund";

/** Siparişe daha ne kadar iade yapılabilir (tutar − önceki iadeler). */
export function refundableAmount(order: Order): number {
  return Math.max(0, Math.round((order.totals.grandTotal - (order.refundedTotal ?? 0)) * 100) / 100);
}

/** İade düğmesi gösterilsin mi: kalan tutar var ve tahsilat yapılmış. */
export function canRefund(order: Order): boolean {
  if (refundableAmount(order) <= 0) return false;
  return !PAYMENT_METHODS[order.paymentMethod].onDelivery || order.status === "delivered";
}

export function canCancel(order: Order): boolean {
  return order.status !== "delivered" && order.status !== "cancelled";
}

/**
 * Yöneticinin manuel iptal ve iade penceresi. İade tutarı siparişin kalan
 * iade edilebilir tutarıyla sınırlıdır (sunucu da aynı sınırı uygular);
 * her işlem gerekçesiyle iz kaydına yazılır.
 */
export function OrderActionModal({
  order,
  kind,
  onClose,
  onDone,
  onError,
}: {
  order: Order;
  kind: OrderActionKind;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const remaining = refundableAmount(order);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(remaining);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api.post(`/admin/orders/${order.id}`, {
        action: kind,
        reason,
        amount: kind === "refund" ? amount : undefined,
      });
      onDone(
        kind === "cancel"
          ? `${order.code} iptal edildi${PAYMENT_METHODS[order.paymentMethod].onDelivery ? "." : ", tutar müşterinin cüzdanına iade edildi."}`
          : `${order.code} için ${formatPrice(amount)} iade edildi.`
      );
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={kind === "cancel" ? "Siparişi iptal et" : "Manuel iade"}
      description={`${order.code} · ${order.restaurantName} · ${formatPrice(order.totals.grandTotal)}`}
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" block onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            variant={kind === "cancel" ? "danger" : "primary"}
            block
            loading={busy}
            disabled={kind === "refund" && (amount <= 0 || amount > remaining)}
            onClick={submit}
          >
            {kind === "cancel" ? "İptal et" : "İadeyi uygula"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {kind === "refund" && (
          <Field
            label="İade tutarı (₺)"
            hint={
              (order.refundedTotal ?? 0) > 0
                ? `Daha önce ${formatPrice(order.refundedTotal ?? 0)} iade edildi; en fazla ${formatPrice(remaining)} daha iade edilebilir.`
                : `En fazla ${formatPrice(remaining)} — kısmi iade yapabilirsin.`
            }
          >
            <Input
              type="number"
              min={1}
              max={remaining}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="tabular"
            />
          </Field>
        )}

        <Field label="Gerekçe" hint="İz kaydına yazılır.">
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={160}
            placeholder={
              kind === "cancel"
                ? "Restoran ulaşılamıyor, kurye bulunamadı…"
                : "Eksik ürün, gecikme tazminatı…"
            }
            autoFocus
          />
        </Field>

        <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted">
          Tutar müşterinin Sofra Cüzdan bakiyesine eklenir. Kredi kartına
          iade gerekiyorsa ödeme geçidi üzerinden ayrıca başlatılmalıdır.
        </p>
      </div>
    </Modal>
  );
}

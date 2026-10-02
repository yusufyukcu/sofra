"use client";

import { Search, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { ORDER_STATUS_META } from "@/lib/constants";
import type { Order } from "@/lib/types";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import {
  OrderActionModal,
  canCancel,
  canRefund,
  refundableAmount,
  type OrderActionKind,
} from "./order-action-modal";

const STATUS_TONE: Record<Order["status"], string> = {
  pending_approval: "bg-saffron-soft text-saffron",
  preparing: "bg-saffron-soft text-saffron",
  on_the_way: "bg-info-soft text-info",
  delivered: "bg-pistachio-soft text-pistachio",
  cancelled: "bg-danger-soft text-danger",
};

/**
 * Sipariş arama ve iade.
 *
 * Canlı operasyon ekranı yalnızca açık siparişleri gösterir; teslim
 * edilmiş bir siparişe (eksik ürün, soğuk yemek…) sonradan iade buradan
 * yapılır. Sipariş kodu, müşteri adı ya da telefonla aranır; boş aramada
 * son kapanan siparişler listelenir.
 */
export function OrderSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const toast = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<{ order: Order; kind: OrderActionKind } | null>(null);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const data = await api.get<{ orders: Order[] }>(`/admin/orders?q=${encodeURIComponent(q.trim())}`);
        setOrders(data.orders);
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Yazarken 300 ms bekle, sonra ara
  useEffect(() => {
    const timer = setTimeout(() => void search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-ink">Siparişler & iade</h1>
        <p className="mt-0.5 text-sm text-muted">
          Teslim edilmiş siparişe iade, açık siparişe iptal. Her işlem iz kaydına yazılır.
        </p>
      </header>

      <label className="card flex items-center gap-3 px-4 py-3">
        <Search className="size-5 shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sipariş kodu (SF-…), müşteri adı ya da telefon"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
          autoFocus
        />
        {loading && <span className="text-xs text-muted">aranıyor…</span>}
      </label>

      {!orders ? (
        <Skeleton className="h-72 w-full" />
      ) : orders.length === 0 ? (
        <EmptyState
          emoji="🔎"
          title="Sipariş bulunamadı"
          description="Kodu tam yazmayı ya da müşterinin telefonunun son 4 hanesini denemeyi unutma."
        />
      ) : (
        <>
          {query.trim().length < 2 && (
            <p className="text-xs font-semibold text-muted">Son kapanan siparişler</p>
          )}
          <ul className="space-y-2.5">
            {orders.map((order) => {
              const refunded = order.refundedTotal ?? 0;
              return (
                <li key={order.id} className="card flex flex-wrap items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-display tabular text-sm font-extrabold text-ink">{order.code}</span>
                      <span className="text-sm text-muted">{order.restaurantName}</span>
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-bold", STATUS_TONE[order.status])}>
                        {ORDER_STATUS_META[order.status].label}
                      </span>
                    </p>
                    <p className="tabular mt-0.5 truncate text-xs text-muted">
                      {formatDateTime(order.createdAt)} · {order.address.contactName ?? order.address.title} ·{" "}
                      {order.address.district} · {order.paymentLabel}
                    </p>
                    {order.cancelReason && (
                      <p className="mt-0.5 truncate text-xs text-danger">İptal: {order.cancelReason}</p>
                    )}
                  </div>

                  <div className="tabular shrink-0 text-right">
                    <p className="text-sm font-extrabold text-ink">{formatPrice(order.totals.grandTotal)}</p>
                    {refunded > 0 && (
                      <p className="text-[11px] font-semibold text-pistachio">
                        {formatPrice(refunded)} iade
                        {refundableAmount(order) === 0 ? " (tamamı)" : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    {canRefund(order) && (
                      <Button size="sm" variant="secondary" onClick={() => setAction({ order, kind: "refund" })}>
                        İade
                      </Button>
                    )}
                    {canCancel(order) && (
                      <Button size="sm" variant="outline" onClick={() => setAction({ order, kind: "cancel" })}>
                        <XCircle className="size-3.5" />
                        İptal
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {action && (
        <OrderActionModal
          order={action.order}
          kind={action.kind}
          onClose={() => setAction(null)}
          onDone={(message) => {
            toast.success(message);
            setAction(null);
            void search(query);
          }}
          onError={(message) => toast.error(message)}
        />
      )}
    </div>
  );
}

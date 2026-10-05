"use client";

import { ChevronDown, ChevronLeft, ChevronRight, FolderOpen, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { ORDER_STATUS_META } from "@/lib/constants";
import type { OrderHistoryPage } from "@/lib/services/vendor";
import type { Order } from "@/lib/types";
import { addDaysToKey, cn, dayKey, formatDateTime, formatPrice } from "@/lib/utils";
import { Button, EmptyState, Field, Input, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type StatusFilter = "all" | "delivered" | "cancelled" | "active";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "delivered", label: "Teslim edilen" },
  { id: "cancelled", label: "İptal" },
  { id: "active", label: "Açık" },
];

const RANGES: { label: string; days: number }[] = [
  { label: "Bugün", days: 0 },
  { label: "7 gün", days: 6 },
  { label: "30 gün", days: 29 },
];

const CANCELLED_BY = { user: "Müşteri", vendor: "Restoran", support: "Destek" } as const;

const STATUS_TONE: Record<Order["status"], string> = {
  pending_approval: "bg-saffron-soft text-saffron",
  preparing: "bg-saffron-soft text-saffron",
  on_the_way: "bg-info-soft text-info",
  delivered: "bg-pistachio-soft text-pistachio",
  cancelled: "bg-danger-soft text-danger",
};

/**
 * Sipariş geçmişi.
 *
 * Teslim edilen ve iptal olan siparişler tarih aralığına ve duruma göre
 * süzülür (günler İstanbul takvimine göredir). Satır açılınca ürünler,
 * iptal nedeni ve müşteri değerlendirmesi görünür. Varsayılan aralık son
 * 7 gün.
 */
export function OrderHistory() {
  const toast = useToast();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [range, setRange] = useState(() => lastDays(6));
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OrderHistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ gecmis: "1", durum: status, sayfa: String(page) });
    if (range.from) params.set("baslangic", range.from);
    if (range.to) params.set("bitis", range.to);
    api
      .get<OrderHistoryPage>(`/vendor/orders?${params}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, range, page, toast]);

  function changeRange(next: { from: string; to: string }) {
    setRange(next);
    setPage(1);
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-ink">Sipariş geçmişi</h1>
        <p className="mt-0.5 text-sm text-muted">
          Teslim edilen ve iptal olan siparişler; tarih aralığı ve duruma göre.
        </p>
      </header>

      {/* Süzgeçler */}
      <section className="card flex flex-wrap items-end gap-4 p-4">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Durum</p>
          <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setStatus(item.id);
                  setPage(1);
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                  status === item.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Hızlı aralık</p>
          <div className="flex gap-1.5">
            {RANGES.map((item) => {
              const preset = lastDays(item.days);
              const active = preset.from === range.from && preset.to === range.to;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => changeRange(preset)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors",
                    active
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border text-muted hover:text-ink"
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Başlangıç" className="w-40">
          <Input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => changeRange({ ...range, from: e.target.value })}
            className="tabular"
          />
        </Field>
        <Field label="Bitiş" className="w-40">
          <Input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => changeRange({ ...range, to: e.target.value })}
            className="tabular"
          />
        </Field>
      </section>

      {/* Özet */}
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Sipariş" value={String(data.total)} />
          <Stat label="Teslim edilen" value={String(data.totals.delivered)} />
          <Stat label="İptal" value={String(data.totals.cancelled)} />
          <Stat label="Brüt ciro (teslim)" value={formatPrice(data.totals.gross)} />
        </div>
      )}

      {/* Liste */}
      {!data && loading ? (
        <Skeleton className="h-80 w-full" />
      ) : !data || data.orders.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Bu aralıkta sipariş yok"
          description="Tarih aralığını genişletmeyi ya da durumu değiştirmeyi dene."
        />
      ) : (
        <section className={cn("card divide-y divide-border overflow-hidden", loading && "opacity-60")}>
          {data.orders.map((order) => (
            <HistoryRow
              key={order.id}
              order={order}
              open={open === order.id}
              onToggle={() => setOpen(open === order.id ? null : order.id)}
            />
          ))}
        </section>
      )}

      {data && pages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="size-4" />
            Önceki
          </Button>
          <span className="tabular text-sm text-muted">
            Sayfa {page} / {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages || loading}
            onClick={() => setPage(page + 1)}
          >
            Sonraki
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function lastDays(days: number) {
  const to = dayKey(new Date());
  return { from: addDaysToKey(to, -days), to };
}

function HistoryRow({
  order,
  open,
  onToggle,
}: {
  order: Order;
  open: boolean;
  onToggle: () => void;
}) {
  const meta = ORDER_STATUS_META[order.status];
  const items = order.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display tabular text-sm font-extrabold text-ink">{order.code}</span>
            <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-bold", STATUS_TONE[order.status])}>
              {meta.label}
            </span>
            {order.rating && (
              <span className="tabular inline-flex items-center gap-0.5 text-xs font-bold text-saffron">
                <Star className="size-3 fill-current" />
                {order.rating.restaurantScore}
              </span>
            )}
          </span>
          <span className="tabular mt-0.5 block text-xs text-muted">
            {formatDateTime(order.createdAt)} · {items} ürün · {order.paymentLabel}
          </span>
        </span>
        <span className="tabular text-sm font-bold text-ink">{formatPrice(order.totals.subtotal)}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-3 bg-surface-2/40 px-4 pb-4 pt-1">
          <ul className="space-y-1">
            {order.lines.map((line) => (
              <li key={line.lineId} className="flex gap-2 text-sm">
                <span className="tabular w-6 shrink-0 font-bold text-ink">{line.quantity}×</span>
                <span className="min-w-0 flex-1 text-ink">
                  {line.name}
                  {line.selections.length > 0 && (
                    <span className="block text-xs text-muted">
                      {line.selections.flatMap((s) => s.optionNames).join(", ")}
                    </span>
                  )}
                </span>
                <span className="tabular text-muted">{formatPrice(line.unitPrice * line.quantity)}</span>
              </li>
            ))}
          </ul>

          {order.preferences.note && (
            <p className="rounded-lg bg-surface px-3 py-2 text-xs italic text-muted">
              Not: {order.preferences.note}
            </p>
          )}

          {order.status === "cancelled" && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
              {order.cancelledBy ? `${CANCELLED_BY[order.cancelledBy]} iptal etti` : "İptal edildi"}
              {order.cancelledAt && ` · ${formatDateTime(order.cancelledAt)}`}
              {order.cancelReason && ` · ${order.cancelReason}`}
            </p>
          )}

          {order.rating && (
            <div className="rounded-lg bg-surface px-3 py-2 text-xs">
              <p className="font-semibold text-ink">
                Değerlendirme: {order.rating.restaurantScore}/5
              </p>
              {order.rating.restaurantComment && (
                <p className="mt-0.5 italic text-muted">“{order.rating.restaurantComment}”</p>
              )}
            </div>
          )}

          <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
            <Pair label="Ara toplam" value={formatPrice(order.totals.subtotal)} />
            <Pair label="İndirim" value={formatPrice(order.totals.discount)} />
            <Pair label="Teslimat" value={formatPrice(order.totals.deliveryFee)} />
            <Pair label="Müşteri ödedi" value={formatPrice(order.totals.grandTotal)} />
          </dl>
        </div>
      )}
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 sm:block">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="font-display tabular mt-1 text-xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

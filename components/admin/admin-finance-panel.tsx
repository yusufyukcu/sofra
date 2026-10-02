"use client";

import { Check, CreditCard, Table2, TrendingUp, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { AdminFinance } from "@/lib/services/admin";
import { useAdmin } from "@/lib/store/admin";
import type { Payout } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type PayoutFilter = "pending" | "approved" | "paid" | "all";

const PAYOUT_STATUS = {
  pending: { label: "Onay bekliyor", className: "bg-saffron-soft text-saffron" },
  approved: { label: "Onaylandı", className: "bg-info-soft text-info" },
  paid: { label: "Ödendi", className: "bg-pistachio-soft text-pistachio" },
} as const;

/**
 * Finansal mutabakat ve analitik.
 *
 * GMV müşterilerin ödediği toplam tutardır; net gelir platformda kalan
 * kısımdır. Grafikte ikisi üst üste yığılır: alt bölüm platformun geliri,
 * üst bölüm restoran, kurye ve indirimlere giden pay — toplamı GMV'yi verir.
 *
 * Seri renkleri `--chart-net` / `--chart-commission` jetonlarından gelir;
 * açık ve koyu mod adımları ayrı seçilip doğrulandı.
 */
export function AdminFinancePanel() {
  const toast = useToast();
  const setKpi = useAdmin((s) => s.setKpi);

  const [data, setData] = useState<AdminFinance | null>(null);
  const [filter, setFilter] = useState<PayoutFilter>("pending");
  const [asTable, setAsTable] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get<AdminFinance>("/admin/finance"));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(payout: Payout, action: "approve" | "pay") {
    setBusyId(payout.id);
    try {
      const result = await api.post<AdminFinance>(
        `/admin/payouts/${payout.id}`,
        { action }
      );
      setData(result);
      toast.success(
        action === "approve"
          ? `${payout.targetName} hakedişi onaylandı.`
          : `${payout.targetName} hakedişi ödendi.`
      );
      const me = await api.get<{ kpi: Parameters<typeof setKpi>[0] }>(
        "/admin/auth/me"
      );
      setKpi(me.kpi);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const payouts = useMemo(() => {
    if (!data) return [];
    return filter === "all"
      ? data.payouts
      : data.payouts.filter((p) => p.status === filter);
  }, [data, filter]);

  if (!data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const { summary, buckets, gateway } = data;
  const maxGmv = Math.max(1, ...buckets.map((b) => b.gmv));
  const hasData = buckets.some((b) => b.gmv > 0);

  const counts = {
    pending: data.payouts.filter((p) => p.status === "pending").length,
    approved: data.payouts.filter((p) => p.status === "approved").length,
    paid: data.payouts.filter((p) => p.status === "paid").length,
    all: data.payouts.length,
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-ink">Finans</h1>
        <p className="mt-0.5 text-sm text-muted">
          GMV, net gelir, ödeme geçidi raporları ve hakediş onay akışı.
        </p>
      </header>

      {/* Başlık sayıları */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="GMV (brüt ürün hacmi)"
          value={formatPrice(summary.gmv)}
          hint={`${summary.orders} teslim edilen sipariş`}
        />
        <Kpi
          label="Platform net geliri"
          value={formatPrice(summary.netRevenue)}
          hint={
            summary.gmv
              ? `GMV'nin %${Math.round((summary.netRevenue / summary.gmv) * 100)}'i`
              : undefined
          }
          emphasis
        />
        <Kpi
          label="Komisyon geliri"
          value={formatPrice(summary.commission)}
          hint={`Hizmet bedeli ${formatPrice(summary.serviceFees)}`}
        />
        <Kpi
          label="Ortalama sepet"
          value={formatPrice(summary.avgOrderValue)}
          hint={`${summary.cancelled} iptal`}
        />
      </div>

      {/* Kâr-zarar kırılımı */}
      <section className="card p-5">
        <h2 className="font-display text-base font-extrabold text-ink">
          Gelir kırılımı
        </h2>
        <dl className="tabular mt-4 space-y-2 text-sm">
          <Row label="Platform komisyonu" value={summary.commission} positive />
          <Row label="Hizmet bedeli" value={summary.serviceFees} positive />
          <Row label="Teslimat ücreti" value={summary.deliveryFees} positive />
          <Row label="Kurye ödemeleri" value={-summary.courierCost} />
          <Row label="Karşılanan indirimler" value={-summary.discounts} />
          <Row label="Ödeme geçidi komisyonu" value={-summary.gatewayCost} />
          <Row label="Manuel iadeler (teslim edilen)" value={-summary.refunds} />
          <div className="flex justify-between border-t border-border pt-2.5 text-base">
            <dt className="font-display font-extrabold text-ink">Net gelir</dt>
            <dd className="font-display font-extrabold text-brand">
              {formatPrice(summary.netRevenue)}
            </dd>
          </div>
        </dl>
      </section>

      {/* GMV grafiği */}
      <section className="card p-5">
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-extrabold text-ink">
              Son 14 gün
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Sütunun tamamı GMV; alt bölüm platformda kalan net gelirdir.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink"
          >
            {asTable ? (
              <>
                <TrendingUp className="size-3.5" />
                Grafik
              </>
            ) : (
              <>
                <Table2 className="size-3.5" />
                Tablo
              </>
            )}
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <Swatch color="var(--chart-net)" label="Platform net geliri" />
          <Swatch
            color="var(--chart-commission)"
            label="Restoran, kurye ve indirim payı"
          />
        </div>

        {!hasData ? (
          <EmptyState
            emoji="📊"
            title="Bu dönemde teslim edilen sipariş yok"
            description="Siparişler tamamlandıkça GMV burada birikir."
          />
        ) : asTable ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Gün</Th>
                  <Th align="right">Sipariş</Th>
                  <Th align="right">GMV</Th>
                  <Th align="right">Net gelir</Th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket) => (
                  <tr key={bucket.key} className="border-b border-border">
                    <Td>{bucket.label}</Td>
                    <Td align="right">{bucket.orders}</Td>
                    <Td align="right">{formatPrice(bucket.gmv)}</Td>
                    <Td align="right" strong>
                      {formatPrice(bucket.netRevenue)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="relative">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-48">
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                <div
                  key={ratio}
                  className="absolute inset-x-0 border-t border-chart-grid"
                  style={{ top: `${ratio * 100}%` }}
                />
              ))}
            </div>

            <div className="relative flex h-48 items-end gap-1.5">
              {buckets.map((bucket) => {
                const height = (bucket.gmv / maxGmv) * 100;
                const netShare = bucket.gmv
                  ? Math.max(0, Math.min(1, bucket.netRevenue / bucket.gmv))
                  : 0;
                const active = hovered === bucket.key;

                return (
                  <div
                    key={bucket.key}
                    className="relative flex h-full flex-1 items-end"
                    onMouseEnter={() => setHovered(bucket.key)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(bucket.key)}
                    onBlur={() => setHovered(null)}
                    tabIndex={0}
                    role="img"
                    aria-label={`${bucket.label}: ${bucket.orders} sipariş, GMV ${formatPrice(bucket.gmv)}, net gelir ${formatPrice(bucket.netRevenue)}`}
                  >
                    <div
                      className="flex w-full flex-col justify-end transition-opacity"
                      style={{
                        height: `${Math.max(height, bucket.gmv > 0 ? 3 : 0)}%`,
                        opacity: hovered && !active ? 0.55 : 1,
                      }}
                    >
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${(1 - netShare) * 100}%`,
                          background: "var(--chart-commission)",
                          marginBottom: bucket.gmv > 0 ? 2 : 0,
                        }}
                      />
                      <div
                        className="w-full rounded-b-sm"
                        style={{
                          height: `${netShare * 100}%`,
                          background: "var(--chart-net)",
                        }}
                      />
                    </div>

                    {active && bucket.gmv > 0 && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-44 -translate-x-1/2 rounded-xl border border-border bg-surface p-3 shadow-float">
                        <p className="text-xs font-bold text-ink">
                          {bucket.label}
                        </p>
                        <dl className="tabular mt-1.5 space-y-1 text-xs text-muted">
                          <MiniRow
                            label="Sipariş"
                            value={String(bucket.orders)}
                          />
                          <MiniRow label="GMV" value={formatPrice(bucket.gmv)} />
                          <div className="flex justify-between border-t border-border pt-1 font-bold text-ink">
                            <dt>Net gelir</dt>
                            <dd>{formatPrice(bucket.netRevenue)}</dd>
                          </div>
                        </dl>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-2 flex gap-1.5">
              {buckets.map((bucket, index) => (
                <span
                  key={bucket.key}
                  className="tabular flex-1 truncate text-center text-[10px] text-muted"
                >
                  {index % 3 === 0 || index === buckets.length - 1
                    ? bucket.label.split(" ")[0]
                    : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Ödeme geçidi */}
        <section className="card overflow-hidden">
          <h2 className="font-display flex items-center gap-2 border-b border-border px-5 py-3.5 text-base font-extrabold text-ink">
            <CreditCard className="size-4 text-muted" />
            Ödeme geçidi raporu
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-left">
                  <Th>Yöntem</Th>
                  <Th align="right">Sipariş</Th>
                  <Th align="right">Hacim</Th>
                  <Th align="right">Geçit kesintisi</Th>
                  <Th align="right">İade</Th>
                  <Th>Valör</Th>
                </tr>
              </thead>
              <tbody>
                {gateway.map((row) => (
                  <tr key={row.method} className="border-b border-border last:border-0">
                    <Td>{row.label}</Td>
                    <Td align="right">{row.orders}</Td>
                    <Td align="right">{formatPrice(row.volume)}</Td>
                    <Td align="right">
                      {row.gatewayFee > 0 ? `− ${formatPrice(row.gatewayFee)}` : "—"}
                    </Td>
                    <Td align="right">
                      {row.refunded > 0 ? `− ${formatPrice(row.refunded)}` : "—"}
                    </Td>
                    <Td>
                      <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-muted">
                        {row.settlement}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="border-t border-border px-5 py-3 text-xs leading-relaxed text-muted">
            Online ödemelerde geçit komisyonu işlem tutarının %1,8&apos;i +
            0,25&nbsp;₺ olarak hesaplanır. Kapıda ödeme ve cüzdan
            harcamalarında geçit kesintisi yoktur. İade sütunu iptal ve manuel
            iadelerde müşteriye geri verilen tutardır (cüzdana yatırılır).
          </p>
        </section>

        {/* Hakedişler */}
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
            <h2 className="font-display flex items-center gap-2 text-base font-extrabold text-ink">
              <Wallet className="size-4 text-muted" />
              Hakedişler
            </h2>
            <div className="tabular ml-auto flex gap-3 text-xs">
              <span className="text-saffron">
                Bekleyen {formatPrice(data.payoutTotals.pending)}
              </span>
              <span className="text-info">
                Onaylı {formatPrice(data.payoutTotals.approved)}
              </span>
              <span className="text-pistachio">
                Ödenen {formatPrice(data.payoutTotals.paid)}
              </span>
            </div>
          </div>

          <div className="flex gap-1 border-b border-border bg-surface-2/60 p-2">
            {(
              [
                ["pending", "Bekleyen"],
                ["approved", "Onaylı"],
                ["paid", "Ödenen"],
                ["all", "Tümü"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors",
                  filter === id
                    ? "bg-surface text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                )}
              >
                {label}
                <span className="tabular ml-1 text-muted">{counts[id]}</span>
              </button>
            ))}
          </div>

          {payouts.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">
              Bu durumda hakediş yok.
            </p>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-border overflow-y-auto">
              {payouts.map((payout) => {
                const status = PAYOUT_STATUS[payout.status];
                const busy = busyId === payout.id;

                return (
                  <li
                    key={payout.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-3"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-base">
                      {payout.kind === "vendor" ? "🏪" : "🛵"}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">
                        {payout.targetName}
                      </p>
                      <p className="tabular truncate text-xs text-muted">
                        {payout.periodLabel} · {payout.orders}{" "}
                        {payout.kind === "vendor" ? "sipariş" : "teslimat"}
                        {payout.kind === "vendor"
                          ? ` · komisyon ${formatPrice(payout.commission)}`
                          : payout.tips > 0
                            ? ` · bahşiş ${formatPrice(payout.tips)}`
                            : ""}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold",
                        status.className
                      )}
                    >
                      {status.label}
                    </span>

                    <span className="tabular shrink-0 text-sm font-extrabold text-ink">
                      {formatPrice(payout.net)}
                    </span>

                    {payout.status === "pending" && (
                      <Button
                        size="sm"
                        loading={busy}
                        onClick={() => act(payout, "approve")}
                      >
                        <Check className="size-3.5" />
                        Onayla
                      </Button>
                    )}
                    {payout.status === "approved" && (
                      <Button
                        size="sm"
                        variant="success"
                        loading={busy}
                        onClick={() => act(payout, "pay")}
                      >
                        Ödendi işaretle
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="border-t border-border px-5 py-3 text-xs leading-relaxed text-muted">
            Onaylanan hakedişin tutarı dondurulur; sonradan gelen düzeltmeler
            bir sonraki döneme yazılır. Durum, restoran panelinde ve kurye
            uygulamasında aynı anda görünür.
          </p>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Kpi({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={cn("card p-4", emphasis && "border-brand/35 bg-brand-soft")}>
      <p
        className={cn(
          "text-xs font-semibold",
          emphasis ? "text-brand" : "text-muted"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "font-display tabular mt-1 text-2xl font-extrabold",
          emphasis ? "text-brand" : "text-ink"
        )}
      >
        {value}
      </p>
      {hint && <p className="tabular mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Row({
  label,
  value,
  positive,
}: {
  label: string;
  value: number;
  positive?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd
        className={cn(
          "font-semibold",
          positive ? "text-ink" : value < 0 ? "text-danger" : "text-ink"
        )}
      >
        {value < 0 ? `− ${formatPrice(Math.abs(value))}` : formatPrice(value)}
      </dd>
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span
        aria-hidden
        className="size-2.5 rounded-sm"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted",
        align === "right" && "text-right"
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  strong,
}: {
  children: React.ReactNode;
  align?: "right";
  strong?: boolean;
}) {
  return (
    <td
      className={cn(
        "tabular px-4 py-2.5 text-sm",
        align === "right" && "text-right",
        strong ? "font-extrabold text-ink" : "text-text"
      )}
    >
      {children}
    </td>
  );
}

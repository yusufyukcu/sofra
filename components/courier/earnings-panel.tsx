"use client";

import { Bike } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { EarningsReport } from "@/lib/services/courier";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/**
 * Kazanç ekranı.
 *
 * Grafikte iki seri var: paket ücreti ve bahşiş; üst üste yığılınca o günün
 * toplam kazancını verir. Seri renkleri `--chart-net` / `--chart-commission`
 * jetonlarından gelir (açık ve koyu mod adımları ayrı ayrı doğrulandı).
 */

/** Hakediş durumu — yönetici panelindeki onay akışını yansıtır. */
const PAYOUT_STATUS = {
  paid: { label: "Ödendi", className: "bg-pistachio-soft text-pistachio" },
  approved: { label: "Onaylandı", className: "bg-saffron-soft text-saffron" },
  pending: { label: "Onay bekliyor", className: "bg-surface-2 text-muted" },
} as const;

export function EarningsPanel() {
  const toast = useToast();
  const [report, setReport] = useState<EarningsReport | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ report: EarningsReport }>("/courier/earnings")
      .then((data) => setReport(data.report))
      .catch((err) => toast.error(errorMessage(err)));
  }, [toast]);

  if (!report) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { totals, buckets, payouts, recent } = report;
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const hasData = buckets.some((b) => b.total > 0);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-xl font-extrabold text-ink">Kazanç</h1>
        <p className="mt-0.5 text-sm text-muted">
          Paket ücretleri ve bahşişler · haftalık hakediş
        </p>
      </header>

      <div className="card p-4">
        <p className="text-xs font-semibold text-muted">Toplam kazanç</p>
        <p className="font-display tabular mt-0.5 text-3xl font-extrabold text-ink">
          {formatPrice(totals.total)}
        </p>
        <div className="tabular mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
          <div>
            <p className="text-[11px] text-muted">Teslimat</p>
            <p className="font-bold text-ink">{totals.deliveries}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Paket ücreti</p>
            <p className="font-bold text-ink">{formatPrice(totals.fee)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Bahşiş</p>
            <p className="font-bold text-pistachio">{formatPrice(totals.tip)}</p>
          </div>
        </div>
      </div>

      {/* Son 14 gün */}
      <section className="card p-4">
        <h2 className="font-display text-sm font-extrabold text-ink">
          Son 14 gün
        </h2>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          <Swatch color="var(--chart-net)" label="Paket ücreti" />
          <Swatch color="var(--chart-commission)" label="Bahşiş" />
        </div>

        {!hasData ? (
          <p className="py-8 text-center text-sm text-muted">
            Henüz tamamlanmış teslimatın yok.
          </p>
        ) : (
          <div className="relative mt-4">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32">
              {[0, 0.5, 1].map((ratio) => (
                <div
                  key={ratio}
                  className="absolute inset-x-0 border-t border-chart-grid"
                  style={{ top: `${ratio * 100}%` }}
                />
              ))}
            </div>

            <div className="relative flex h-32 items-end gap-1">
              {buckets.map((bucket) => {
                const height = (bucket.total / max) * 100;
                const feeShare = bucket.total ? bucket.fee / bucket.total : 1;
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
                    aria-label={`${bucket.label}: ${bucket.deliveries} teslimat, ${formatPrice(bucket.total)}`}
                  >
                    <div
                      className="flex w-full flex-col justify-end transition-opacity"
                      style={{
                        height: `${Math.max(height, bucket.total > 0 ? 4 : 0)}%`,
                        opacity: hovered && !active ? 0.5 : 1,
                      }}
                    >
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${(1 - feeShare) * 100}%`,
                          background: "var(--chart-commission)",
                          marginBottom: bucket.total > 0 ? 2 : 0,
                        }}
                      />
                      <div
                        className="w-full rounded-b-sm"
                        style={{
                          height: `${feeShare * 100}%`,
                          background: "var(--chart-net)",
                        }}
                      />
                    </div>

                    {active && bucket.total > 0 && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-36 -translate-x-1/2 rounded-xl border border-border bg-surface p-2.5 shadow-float">
                        <p className="text-xs font-bold text-ink">
                          {bucket.label}
                        </p>
                        <dl className="tabular mt-1 space-y-0.5 text-[11px] text-muted">
                          <Row label="Teslimat" value={String(bucket.deliveries)} />
                          <Row label="Ücret" value={formatPrice(bucket.fee)} />
                          <Row label="Bahşiş" value={formatPrice(bucket.tip)} />
                        </dl>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-1.5 flex gap-1">
              {buckets.map((bucket, index) => (
                <span
                  key={bucket.key}
                  className="tabular flex-1 truncate text-center text-[9px] text-muted"
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

      {/* Hakediş */}
      <section className="card overflow-hidden">
        <h2 className="font-display border-b border-border px-4 py-3 text-sm font-extrabold text-ink">
          Haftalık hakediş
        </h2>
        {payouts.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">
            Teslimat biriktikçe hakedişlerin burada listelenir.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {payouts.map((payout) => {
              const status = PAYOUT_STATUS[payout.status];
              return (
                <li
                  key={payout.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {payout.label}
                    </p>
                    <p className="tabular text-xs text-muted">
                      {payout.deliveries} teslimat
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
                    {formatPrice(payout.total)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Son teslimatlar */}
      <section className="card overflow-hidden">
        <h2 className="font-display border-b border-border px-4 py-3 text-sm font-extrabold text-ink">
          Son teslimatlar
        </h2>
        {recent.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Bike}
              title="Henüz teslimat yok"
              description="Mesaiyi başlat ve ilk siparişini al."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((earning) => (
              <li key={earning.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {earning.restaurantName}
                  </p>
                  <p className="tabular truncate text-xs text-muted">
                    {earning.orderCode} · {earning.distanceKm} km ·{" "}
                    {earning.durationMinutes} dk · {formatDateTime(earning.at)}
                  </p>
                </div>
                <div className="tabular shrink-0 text-right">
                  <p className="text-sm font-extrabold text-ink">
                    {formatPrice(earning.fee + earning.tip)}
                  </p>
                  {earning.tip > 0 && (
                    <p className="text-[11px] font-semibold text-pistachio">
                      +{formatPrice(earning.tip)} bahşiş
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}

"use client";

import { Table2, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { FinancePeriod, FinanceReport } from "@/lib/services/vendor";
import { cn, formatPrice } from "@/lib/utils";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/**
 * Finans ve raporlama.
 *
 * Grafikte iki seri var: net hakediş ve platform komisyonu. İkisi üst üste
 * yığılınca o günün brüt cirosunu verir — restoran hem kazancını hem
 * kesintiyi tek bakışta görür.
 *
 * Seri renkleri `--chart-net` / `--chart-commission` jetonlarından gelir;
 * açık ve koyu mod adımları ayrı ayrı seçilip doğrulandı (parlaklık bandı,
 * kroma tabanı, renk körlüğü ayrımı ve zemin kontrastı).
 */

const PERIODS: { id: FinancePeriod; label: string }[] = [
  { id: "day", label: "Günlük" },
  { id: "week", label: "Haftalık" },
  { id: "month", label: "Aylık" },
];

/** Hakediş durumu — yönetici panelindeki onay akışını yansıtır. */
const PAYOUT_STATUS = {
  paid: { label: "Ödendi", className: "bg-pistachio-soft text-pistachio" },
  approved: { label: "Onaylandı", className: "bg-saffron-soft text-saffron" },
  pending: { label: "Onay bekliyor", className: "bg-surface-2 text-muted" },
} as const;

export function FinancePanel() {
  const toast = useToast();
  const [period, setPeriod] = useState<FinancePeriod>("day");
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [asTable, setAsTable] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    setReport(null);
    api
      .get<{ report: FinanceReport }>(`/vendor/finance?donem=${period}`)
      .then((data) => setReport(data.report))
      .catch((err) => toast.error(errorMessage(err)));
  }, [period, toast]);

  if (!report) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const { totals, buckets, payouts, topProducts } = report;
  const maxGross = Math.max(1, ...buckets.map((b) => b.gross));
  const hasData = buckets.some((b) => b.gross > 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">
            Finans
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Platform komisyonun %{Math.round(report.commissionRate * 100)}.
            Teslimat ve hizmet bedeli platforma aittir, hakedişine girmez.
          </p>
        </div>

        {/* Filtreler tek sırada, grafiklerin üstünde */}
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                period === item.id
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Özet — grafik değil, başlık sayıları */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Net hakediş"
          value={formatPrice(totals.net)}
          hint={`${totals.orders} teslim edilen sipariş`}
          emphasis
        />
        <StatTile label="Brüt ciro" value={formatPrice(totals.gross)} />
        <StatTile
          label="Platform komisyonu"
          value={formatPrice(totals.commission)}
          hint={`%${Math.round(report.commissionRate * 100)} oran`}
        />
        <StatTile
          label="Ortalama sepet"
          value={formatPrice(totals.avgBasket)}
          hint={`İptal oranı %${totals.cancelRate}`}
        />
      </div>

      {/* Ciro grafiği */}
      <section className="card p-5">
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-extrabold text-ink">
              {period === "day"
                ? "Son 14 gün"
                : period === "week"
                  ? "Son 8 hafta"
                  : "Son 6 ay"}{" "}
              cirosu
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Sütunun tamamı brüt ciro; alt bölüm sana kalan net tutardır.
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

        {/* Gösterge — iki seri olduğu için her zaman görünür */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <LegendSwatch color="var(--chart-net)" label="Net hakediş" />
          <LegendSwatch
            color="var(--chart-commission)"
            label="Platform komisyonu"
          />
        </div>

        {!hasData ? (
          <EmptyState
            emoji="📊"
            title="Bu dönemde teslim edilen sipariş yok"
            description="Siparişler teslim edildikçe ciro burada birikir."
          />
        ) : asTable ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Dönem</Th>
                  <Th align="right">Sipariş</Th>
                  <Th align="right">Brüt</Th>
                  <Th align="right">Komisyon</Th>
                  <Th align="right">Net</Th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket) => (
                  <tr key={bucket.key} className="border-b border-border">
                    <Td>{bucket.label}</Td>
                    <Td align="right">{bucket.orders}</Td>
                    <Td align="right">{formatPrice(bucket.gross)}</Td>
                    <Td align="right">{formatPrice(bucket.commission)}</Td>
                    <Td align="right" strong>
                      {formatPrice(bucket.net)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="relative">
            {/* Izgara — geri planda */}
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
                const heightPct = (bucket.gross / maxGross) * 100;
                const netShare = bucket.gross ? bucket.net / bucket.gross : 0;
                const active = hovered === bucket.key;

                return (
                  <div
                    key={bucket.key}
                    className="group relative flex h-full flex-1 items-end"
                    onMouseEnter={() => setHovered(bucket.key)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(bucket.key)}
                    onBlur={() => setHovered(null)}
                    tabIndex={0}
                    role="img"
                    aria-label={`${bucket.label}: ${bucket.orders} sipariş, brüt ${formatPrice(bucket.gross)}, net ${formatPrice(bucket.net)}`}
                  >
                    <div
                      className="flex w-full flex-col justify-end transition-opacity"
                      style={{
                        height: `${Math.max(heightPct, bucket.gross > 0 ? 3 : 0)}%`,
                        opacity: hovered && !active ? 0.55 : 1,
                      }}
                    >
                      {/* Komisyon (üst) */}
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${(1 - netShare) * 100}%`,
                          background: "var(--chart-commission)",
                          // Yığın bölümleri arasında 2px yüzey boşluğu
                          marginBottom: bucket.gross > 0 ? 2 : 0,
                        }}
                      />
                      {/* Net (alt, taban çizgisine yaslı) */}
                      <div
                        className="w-full rounded-b-sm"
                        style={{
                          height: `${netShare * 100}%`,
                          background: "var(--chart-net)",
                        }}
                      />
                    </div>

                    {active && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-44 -translate-x-1/2 rounded-xl border border-border bg-surface p-3 shadow-float">
                        <p className="text-xs font-bold text-ink">
                          {bucket.label}
                        </p>
                        <dl className="tabular mt-1.5 space-y-1 text-xs">
                          <Row label="Sipariş" value={String(bucket.orders)} />
                          <Row label="Brüt" value={formatPrice(bucket.gross)} />
                          <Row
                            label="Komisyon"
                            value={`− ${formatPrice(bucket.commission)}`}
                          />
                          <div className="flex justify-between border-t border-border pt-1 font-bold text-ink">
                            <dt>Net</dt>
                            <dd>{formatPrice(bucket.net)}</dd>
                          </div>
                        </dl>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Eksen etiketleri — hepsi değil, seçili olanlar */}
            <div className="mt-2 flex gap-1.5">
              {buckets.map((bucket, index) => {
                const step = buckets.length > 10 ? 3 : 1;
                const show = index % step === 0 || index === buckets.length - 1;
                return (
                  <span
                    key={bucket.key}
                    className="tabular flex-1 truncate text-center text-[10px] text-muted"
                  >
                    {show ? bucket.label.split(" ")[0] : ""}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Hakediş tablosu */}
        <section className="card overflow-hidden">
          <h2 className="font-display border-b border-border px-5 py-3.5 text-base font-extrabold text-ink">
            Hakediş ödemeleri
          </h2>

          {payouts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">
              Teslim edilen sipariş biriktikçe haftalık hakedişlerin burada
              listelenir.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-left">
                    <Th>Dönem</Th>
                    <Th align="right">Brüt</Th>
                    <Th align="right">Komisyon</Th>
                    <Th align="right">Net</Th>
                    <Th>Durum</Th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => {
                    const status = PAYOUT_STATUS[payout.status];
                    return (
                      <tr key={payout.id} className="border-b border-border last:border-0">
                        <Td>
                          {payout.label}
                          <span className="tabular block text-xs text-muted">
                            {payout.orders} sipariş
                          </span>
                        </Td>
                        <Td align="right">{formatPrice(payout.gross)}</Td>
                        <Td align="right">− {formatPrice(payout.commission)}</Td>
                        <Td align="right" strong>
                          {formatPrice(payout.net)}
                        </Td>
                        <Td>
                          <span
                            className={cn(
                              "inline-block rounded-md px-2 py-0.5 text-[11px] font-bold",
                              status.className
                            )}
                          >
                            {status.label}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* En çok satanlar — tek seri, gösterge gerekmez */}
        <section className="card p-5">
          <h2 className="font-display text-base font-extrabold text-ink">
            En çok ciro getiren ürünler
          </h2>

          {topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Henüz yeterli satış verisi yok.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {topProducts.map((product) => {
                const max = topProducts[0].revenue || 1;
                return (
                  <li key={product.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-ink">
                        {product.name}
                      </span>
                      <span className="tabular shrink-0 text-sm font-bold text-ink">
                        {formatPrice(product.revenue)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-r"
                          style={{
                            width: `${(product.revenue / max) * 100}%`,
                            background: "var(--chart-net)",
                          }}
                        />
                      </div>
                      <span className="tabular w-16 shrink-0 text-right text-xs text-muted">
                        {product.quantity} adet
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatTile({
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

function LegendSwatch({ color, label }: { color: string; label: string }) {
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <dt>{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}

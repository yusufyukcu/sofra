"use client";

import { Check, Clock, Star, ThumbsDown, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { PerformanceReport } from "@/lib/services/courier";
import { cn, formatDistance } from "@/lib/utils";
import { Skeleton, Stars } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/**
 * Performans metrikleri.
 *
 * Kuryenin kendi işine bakışı: puan, ortalama teslimat süresi, kabul oranı
 * ve teklif kırılımı. Sayılar tamamlanan teslimatlardan türetilir.
 */
export function PerformancePanel() {
  const toast = useToast();
  const [report, setReport] = useState<PerformanceReport | null>(null);

  useEffect(() => {
    api
      .get<{ report: PerformanceReport }>("/courier/performance")
      .then((data) => setReport(data.report))
      .catch((err) => toast.error(errorMessage(err)));
  }, [toast]);

  if (!report) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const offersTotal =
    report.offers.accepted + report.offers.rejected + report.offers.expired;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-xl font-extrabold text-ink">
          Performans
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          Puanın ve teslimat metriklerin
        </p>
      </header>

      {/* Puan */}
      <section className="card flex items-center gap-4 p-5">
        <div className="text-center">
          <p className="font-display tabular text-4xl font-extrabold text-ink">
            {report.rating.toFixed(1)}
          </p>
          <Stars value={report.rating} size={14} className="mt-1" />
        </div>
        <div className="min-w-0 flex-1 border-l border-border pl-4">
          <p className="tabular text-sm text-muted">
            <span className="font-bold text-ink">{report.ratingCount}</span>{" "}
            müşteri değerlendirmesi
          </p>
          <p className="tabular mt-1 text-sm text-muted">
            <span className="font-bold text-ink">{report.totalDeliveries}</span>{" "}
            toplam teslimat
          </p>
          <p className="tabular mt-1 text-sm text-muted">
            Bu hafta{" "}
            <span className="font-bold text-ink">{report.weekDeliveries}</span>{" "}
            teslimat
          </p>
        </div>
      </section>

      {/* Metrikler */}
      <div className="grid grid-cols-2 gap-3">
        <Metric
          icon={<Clock className="size-4" />}
          label="Ortalama teslimat"
          value={
            report.avgDeliveryMinutes
              ? `${report.avgDeliveryMinutes} dk`
              : "—"
          }
          hint="Teslim alma → teslim etme"
        />
        <Metric
          icon={<Timer className="size-4" />}
          label="En hızlı teslimat"
          value={report.fastestMinutes ? `${report.fastestMinutes} dk` : "—"}
        />
        <Metric
          icon={<Check className="size-4" />}
          label="Kabul oranı"
          value={`%${report.acceptanceRate}`}
          hint={`${offersTotal} teklif`}
          tone={report.acceptanceRate >= 80 ? "good" : undefined}
        />
        <Metric
          icon={<Star className="size-4" />}
          label="Ortalama mesafe"
          value={report.avgDistanceKm ? formatDistance(report.avgDistanceKm) : "—"}
        />
      </div>

      {/* Teklif kırılımı */}
      <section className="card p-5">
        <h2 className="font-display text-sm font-extrabold text-ink">
          Teklif kırılımı
        </h2>

        {offersTotal === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Henüz sana teklif gönderilmedi.
          </p>
        ) : (
          <>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
              <Segment
                value={report.offers.accepted}
                total={offersTotal}
                color="var(--pistachio)"
              />
              <Segment
                value={report.offers.rejected}
                total={offersTotal}
                color="var(--saffron)"
              />
              <Segment
                value={report.offers.expired}
                total={offersTotal}
                color="var(--border-strong)"
              />
            </div>

            <ul className="mt-4 space-y-2.5">
              <OfferRow
                icon={<Check className="size-3.5" />}
                color="var(--pistachio)"
                label="Kabul edilen"
                value={report.offers.accepted}
                total={offersTotal}
              />
              <OfferRow
                icon={<ThumbsDown className="size-3.5" />}
                color="var(--saffron)"
                label="Reddedilen"
                value={report.offers.rejected}
                total={offersTotal}
              />
              <OfferRow
                icon={<Timer className="size-3.5" />}
                color="var(--border-strong)"
                label="Süresi dolan"
                value={report.offers.expired}
                total={offersTotal}
              />
            </ul>

            <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted">
              Kabul oranın yüksek kaldıkça sana daha fazla sipariş gönderilir.
              Reddettiğin sipariş anında sıradaki en yakın kuryeye geçer.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Metric({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "good";
}) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <span className={tone === "good" ? "text-pistachio" : "text-muted"}>
          {icon}
        </span>
        {label}
      </p>
      <p
        className={cn(
          "font-display tabular mt-1 text-xl font-extrabold",
          tone === "good" ? "text-pistachio" : "text-ink"
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function Segment({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  color: string;
}) {
  if (value === 0) return null;
  return (
    <span
      style={{
        width: `${(value / total) * 100}%`,
        background: color,
        marginRight: 2,
      }}
    />
  );
}

function OfferRow({
  icon,
  color,
  label,
  value,
  total,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: number;
  total: number;
}) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-white"
        style={{ background: color }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-muted">{label}</span>
      <span className="tabular font-bold text-ink">{value}</span>
      <span className="tabular w-10 text-right text-xs text-muted">
        %{Math.round((value / total) * 100)}
      </span>
    </li>
  );
}

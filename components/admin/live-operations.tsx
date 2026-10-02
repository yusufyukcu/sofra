"use client";

import { AlertTriangle, History, Radio, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { ORDER_STATUS_META } from "@/lib/constants";
import type { AdminOverview, LiveOrder } from "@/lib/services/admin";
import { useAdmin } from "@/lib/store/admin";
import type { AuditEntry } from "@/lib/types";
import { cn, formatPrice, formatTime, relativeTime } from "@/lib/utils";
import { OpsMap } from "@/components/map";
import { Modal } from "@/components/ui/modal";
import {
  Button,
  EmptyState,
  Field,
  Input,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type Payload = AdminOverview & { audit: AuditEntry[] };

const SEVERITY = {
  ontime: { label: "Zamanında", tone: "#c4351e", className: "text-muted" },
  late: { label: "Gecikti", tone: "#c47f0a", className: "text-saffron" },
  critical: { label: "Kritik", tone: "#c42b1f", className: "text-danger" },
} as const;

/**
 * Canlı operasyon ekranı.
 *
 * Tüm aktif siparişler haritada ve listede; tahmini teslim saatini aşanlar
 * alarm verir. Listeden sipariş iptali ve manuel iade yapılabilir —
 * her işlem iz kaydına yazılır.
 */
export function LiveOperations() {
  const toast = useToast();
  const setKpi = useAdmin((s) => s.setKpi);

  const [data, setData] = useState<Payload | null>(null);
  const [live, setLive] = useState(false);
  const [action, setAction] = useState<{
    order: LiveOrder["order"];
    kind: "cancel" | "refund";
  } | null>(null);

  const apply = useCallback(
    (payload: Payload) => {
      setData(payload);
      setKpi(payload.kpi);
    },
    [setKpi]
  );

  const refresh = useCallback(async () => {
    apply(await api.get<Payload>("/admin/overview"));
  }, [apply]);

  useEffect(() => {
    void refresh().catch(() => undefined);

    const source = new EventSource("/api/v1/admin/overview/stream", {
      withCredentials: true,
    });
    source.addEventListener("overview", (event) => {
      try {
        apply(JSON.parse((event as MessageEvent).data) as Payload);
        setLive(true);
      } catch {
        /* bozuk paket — yoksay */
      }
    });
    source.onerror = () => setLive(false);

    return () => source.close();
  }, [apply, refresh]);

  const markers = useMemo(() => {
    if (!data) return [];

    const orderMarkers = data.live.map((item) => ({
      id: `o_${item.order.id}`,
      point: item.order.address.point,
      emoji: ORDER_STATUS_META[item.order.status].emoji,
      tone: SEVERITY[item.severity].tone,
      label: `${item.order.code} · ${ORDER_STATUS_META[item.order.status].label}`,
      pulse: item.severity === "critical",
    }));

    const courierMarkers = data.couriers.map((courier) => ({
      id: `c_${courier.id}`,
      point: courier.point,
      emoji: courier.emoji,
      tone: courier.busy ? "#2f6bb5" : "#4b7f3e",
      label: `${courier.name} · ${courier.busy ? "teslimatta" : "boşta"}`,
    }));

    return [...orderMarkers, ...courierMarkers];
  }, [data]);

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const { kpi, live: orders, audit } = data;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">
            Canlı operasyon
          </h1>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-muted">
            <Radio
              className={cn("size-3.5", live && "animate-pulse text-pistachio")}
            />
            {live ? "Canlı bağlantı açık" : "Bağlantı kuruluyor…"}
          </p>
        </div>
      </header>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Aktif sipariş" value={String(kpi.activeOrders)} />
        <Kpi
          label="Geciken"
          value={String(kpi.lateOrders)}
          tone={kpi.lateOrders > 0 ? "danger" : undefined}
        />
        <Kpi label="Bugünkü sipariş" value={String(kpi.todayOrders)} />
        <Kpi label="Bugünkü GMV" value={formatPrice(kpi.todayGmv)} />
        <Kpi label="Mesaideki kurye" value={String(kpi.onlineCouriers)} />
        <Kpi label="Açık restoran" value={String(kpi.openRestaurants)} />
      </div>

      {/* Gecikme alarmı */}
      {kpi.lateOrders > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-bold text-ink">
              {kpi.lateOrders} sipariş tahmini teslim saatini aştı
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Listede kırmızı işaretli siparişleri kontrol et; gerekirse
              müşteriye jest bakiyesi tanımla veya siparişi iptal et.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        {/* Harita + liste */}
        <div className="min-w-0 space-y-5">
          <section className="card overflow-hidden">
            <OpsMap markers={markers} className="h-72 w-full lg:h-80" />
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border px-4 py-2.5 text-xs text-muted">
              <Legend color="#c4351e" label="Zamanında sipariş" />
              <Legend color="#c47f0a" label="Geciken sipariş" />
              <Legend color="#c42b1f" label="Kritik gecikme" />
              <Legend color="#2f6bb5" label="Teslimattaki kurye" />
              <Legend color="#4b7f3e" label="Boştaki kurye" />
            </div>
          </section>

          <section>
            <h2 className="font-display mb-3 text-lg font-extrabold text-ink">
              Aktif siparişler
              <span className="tabular ml-2 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-bold text-muted">
                {orders.length}
              </span>
            </h2>

            {orders.length === 0 ? (
              <EmptyState
                emoji="🌙"
                title="Şu an aktif sipariş yok"
                description="Yeni sipariş düştüğünde burada anlık olarak görünecek."
              />
            ) : (
              <ul className="space-y-2.5">
                {orders.map((item) => (
                  <LiveRow
                    key={item.order.id}
                    item={item}
                    onAction={(kind) => setAction({ order: item.order, kind })}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* İz kaydı */}
        <aside>
          <section className="card sticky top-5 overflow-hidden">
            <h2 className="font-display flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-extrabold text-ink">
              <History className="size-4 text-muted" />
              Son yönetici işlemleri
            </h2>

            {audit.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                Henüz manuel işlem yapılmadı.
              </p>
            ) : (
              <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto">
                {audit.map((entry) => (
                  <li key={entry.id} className="px-4 py-3">
                    <p className="text-sm font-semibold text-ink">
                      {entry.action}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {entry.target}
                      {entry.detail ? ` · ${entry.detail}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {entry.actor} · {relativeTime(entry.at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {action && (
        <OrderActionModal
          order={action.order}
          kind={action.kind}
          onClose={() => setAction(null)}
          onDone={async (message) => {
            toast.success(message);
            setAction(null);
            await refresh();
          }}
          onError={(message) => toast.error(message)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LiveRow({
  item,
  onAction,
}: {
  item: LiveOrder;
  onAction: (kind: "cancel" | "refund") => void;
}) {
  const meta = ORDER_STATUS_META[item.order.status];
  const severity = SEVERITY[item.severity];

  return (
    <li
      className={cn(
        "card flex flex-wrap items-center gap-3 p-3.5",
        item.severity === "critical" && "border-danger/40 bg-danger-soft/40",
        item.severity === "late" && "border-saffron/40"
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xl">
        {meta.emoji}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-display tabular text-sm font-extrabold text-ink">
            {item.order.code}
          </span>
          <span className="text-sm text-muted">{item.order.restaurantName}</span>
          <span
            className={cn(
              "rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold",
              severity.className
            )}
          >
            {meta.label}
          </span>
        </p>
        <p className="tabular mt-0.5 truncate text-xs text-muted">
          {item.order.address.district} · {formatTime(item.order.etaAt)}
          {item.lateMinutes > 0 ? (
            <span className={cn("font-bold", severity.className)}>
              {" "}
              · {item.lateMinutes} dk gecikme
            </span>
          ) : (
            ` · ${item.remainingMinutes} dk kaldı`
          )}
          {item.order.courier ? ` · ${item.order.courier.name}` : " · kurye yok"}
        </p>
      </div>

      <span className="tabular shrink-0 text-sm font-extrabold text-ink">
        {formatPrice(item.order.totals.grandTotal)}
      </span>

      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => onAction("refund")}>
          İade
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction("cancel")}>
          <XCircle className="size-3.5" />
          İptal
        </Button>
      </div>
    </li>
  );
}

function OrderActionModal({
  order,
  kind,
  onClose,
  onDone,
  onError,
}: {
  order: LiveOrder["order"];
  kind: "cancel" | "refund";
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(order.totals.grandTotal);
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
          ? `${order.code} iptal edildi, tutar müşterinin cüzdanına iade edildi.`
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
            hint={`En fazla ${formatPrice(order.totals.grandTotal)} — kısmi iade yapabilirsin.`}
          >
            <Input
              type="number"
              min={1}
              max={order.totals.grandTotal}
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

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <div
      className={cn(
        "card p-3.5",
        tone === "danger" && "border-danger/40 bg-danger-soft"
      )}
    >
      <p
        className={cn(
          "text-[11px] font-semibold",
          tone === "danger" ? "text-danger" : "text-muted"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "font-display tabular mt-0.5 text-xl font-extrabold",
          tone === "danger" ? "text-danger" : "text-ink"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="size-2.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

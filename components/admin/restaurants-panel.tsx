"use client";

import { Check, Copy, Link2, Percent, Search, Star, Store, XCircle } from "lucide-react";
import { restaurantPhoto } from "@/lib/photos";
import { RestaurantThumb } from "@/components/ui/restaurant-thumb";
import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { AdminRestaurantRow } from "@/lib/services/admin";
import type { VendorInvite } from "@/lib/services/vendor-onboarding";
import { useAdmin } from "@/lib/store/admin";
import { cn, formatPhone, formatPrice } from "@/lib/utils";
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

type Filter = "pending" | "approved" | "suspended" | "all";

const STATUS = {
  pending: {
    label: "Onay bekliyor",
    className: "bg-saffron-soft text-saffron",
  },
  approved: { label: "Yayında", className: "bg-pistachio-soft text-pistachio" },
  suspended: { label: "Askıda", className: "bg-danger-soft text-danger" },
} as const;

/**
 * Restoran yönetimi.
 *
 * Onay kuyruğu listenin başında durur: yeni başvurular yayına alınmadan
 * müşteri uygulamasında görünmez. Komisyon oranı restoran bazlı belirlenir
 * ve restoranın finans ekranına anında yansır.
 */
export function RestaurantsPanel() {
  const toast = useToast();
  const setKpi = useAdmin((s) => s.setKpi);

  const [rows, setRows] = useState<AdminRestaurantRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const [commissionFor, setCommissionFor] = useState<AdminRestaurantRow | null>(
    null
  );
  const [suspendFor, setSuspendFor] = useState<AdminRestaurantRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [invite, setInvite] = useState<(VendorInvite & { restaurant: string }) | null>(null);

  useEffect(() => {
    api
      .get<{ rows: AdminRestaurantRow[] }>("/admin/restaurants")
      .then((data) => {
        setRows(data.rows);
        // Onay kuyruğu boşaldıysa yan menüdeki sayaç da güncellensin
        void api
          .get<{ kpi: Parameters<typeof setKpi>[0] }>("/admin/auth/me")
          .then((me) => setKpi(me.kpi))
          .catch(() => undefined);
      })
      .catch((err) => {
        toast.error(errorMessage(err));
        setRows([]);
      });
  }, [toast, setKpi]);

  async function act(
    row: AdminRestaurantRow,
    body: Record<string, unknown>,
    message: string
  ) {
    setBusyId(row.restaurant.id);
    try {
      const data = await api.post<{ rows: AdminRestaurantRow[]; invite: VendorInvite | null }>(
        `/admin/restaurants/${row.restaurant.id}`,
        body
      );
      setRows(data.rows);
      toast.success(message);
      // Başvuruyla gelen restoran onaylandı: panel kurulum bağlantısı
      if (data.invite) setInvite({ ...data.invite, restaurant: row.restaurant.name });
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

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLocaleLowerCase("tr");
    return rows.filter((row) => {
      if (filter !== "all" && row.restaurant.approvalStatus !== filter) {
        return false;
      }
      if (!q) return true;
      return (
        row.restaurant.name.toLocaleLowerCase("tr").includes(q) ||
        row.restaurant.district.toLocaleLowerCase("tr").includes(q)
      );
    });
  }, [rows, filter, query]);

  if (!rows) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const counts = {
    pending: rows.filter((r) => r.restaurant.approvalStatus === "pending").length,
    approved: rows.filter((r) => r.restaurant.approvalStatus === "approved")
      .length,
    suspended: rows.filter((r) => r.restaurant.approvalStatus === "suspended")
      .length,
    all: rows.length,
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-ink">
          Restoranlar
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          Başvuru onayı, askıya alma ve restoran bazlı komisyon oranı.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {(
            [
              ["pending", "Onay bekleyen"],
              ["approved", "Yayında"],
              ["suspended", "Askıda"],
              ["all", "Tümü"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                filter === id
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              )}
            >
              {label}
              <span className="tabular ml-1.5 text-xs text-muted">
                {counts[id]}
              </span>
            </button>
          ))}
        </div>

        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-brand sm:max-w-xs">
          <Search className="size-4 shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Restoran veya semt ara"
            aria-label="Restoran ara"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Store}
          title={
            filter === "pending"
              ? "Onay bekleyen başvuru yok"
              : "Bu filtrede restoran yok"
          }
          description="Yeni başvurular geldiğinde onay kuyruğunda görünür."
        />
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((row) => {
            const r = row.restaurant;
            const status = STATUS[r.approvalStatus];
            const busy = busyId === r.id;

            const app = row.application;

            return (
              <li key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-3">
                <RestaurantThumb
                  image={restaurantPhoto(r)}
                  tone={r.tags[0]}
                  className="size-11 rounded-xl"
                />

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-display truncate text-[15px] font-extrabold text-ink">
                      {r.name}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold",
                        status.className
                      )}
                    >
                      {status.label}
                    </span>
                  </p>
                  <p className="tabular truncate text-xs text-muted">
                    {r.district} ·{" "}
                    <Star className="inline size-3 -translate-y-px fill-saffron text-saffron" aria-hidden />{" "}
                    {r.rating.toFixed(1)} · katılım{" "}
                    {new Date(r.joinedAt).toLocaleDateString("tr-TR")}
                  </p>
                </div>

                <div className="tabular hidden shrink-0 text-right sm:block">
                  <p className="text-sm font-bold text-ink">
                    {formatPrice(row.gmv)}
                  </p>
                  <p className="text-[11px] text-muted">
                    {row.orders} sipariş · komisyon{" "}
                    {formatPrice(row.commissionEarned)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setCommissionFor(row)}
                  className="tabular inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm font-bold text-ink transition-colors hover:border-brand hover:text-brand"
                  title="Komisyon oranını değiştir"
                >
                  <Percent className="size-3.5" />
                  {Math.round(r.commissionRate * 100)}
                </button>

                <div className="flex shrink-0 gap-1.5">
                  {r.approvalStatus === "approved" && (
                    <Button
                      size="sm"
                      variant={r.featuredRank ? "primary" : "secondary"}
                      disabled={busy}
                      title={r.featuredRank ? "Öne çıkanlardan çıkar" : "Anasayfada öne çıkar"}
                      onClick={() => {
                        const used = rows.map((x) => x.restaurant.featuredRank ?? 0);
                        const rank = r.featuredRank ? null : Math.max(0, ...used) + 1;
                        void act(
                          row,
                          { action: "feature", rank },
                          rank ? `${r.name} öne çıkanlara eklendi (sıra ${rank}).` : `${r.name} öne çıkanlardan çıkarıldı.`
                        );
                      }}
                    >
                      <Star className={cn("size-3.5", Boolean(r.featuredRank) && "fill-current")} />
                      {r.featuredRank ? `Öne çıkan · ${r.featuredRank}` : "Öne çıkar"}
                    </Button>
                  )}
                  {r.approvalStatus === "approved" && app && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      title="İşletmeye yeni panel kurulum bağlantısı üret"
                      onClick={() => act(row, { action: "invite" }, "Yeni kurulum bağlantısı üretildi.")}
                    >
                      <Link2 className="size-3.5" />
                      Kurulum bağlantısı
                    </Button>
                  )}
                  {r.approvalStatus !== "approved" && (
                    <Button
                      size="sm"
                      loading={busy}
                      onClick={() =>
                        act(row, { action: "approve" }, `${r.name} yayına alındı.`)
                      }
                    >
                      <Check className="size-3.5" />
                      Onayla
                    </Button>
                  )}
                  {r.approvalStatus === "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setSuspendFor(row)}
                    >
                      <XCircle className="size-3.5" />
                      Askıya al
                    </Button>
                  )}
                </div>
                </div>

                {/* Başvuruyla gelen restoranlarda form bilgileri; kararı
                    veren kişi kimi onayladığını görmeden onaylamamalı. */}
                {app && (
                  <dl className="mt-3 grid gap-x-6 gap-y-2 rounded-xl border border-border bg-surface-2 p-3.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <ApplicationFact label="Referans" value={app.code} tabular />
                    <ApplicationFact label="Yetkili" value={app.contactName} />
                    <ApplicationFact
                      label="İletişim"
                      value={`${formatPhone(app.phone)} · ${app.email}`}
                      tabular
                    />
                    <ApplicationFact
                      label="Adres"
                      value={`${app.address}, ${app.district}/${app.city}`}
                      className="sm:col-span-2"
                    />
                    <ApplicationFact
                      label="Teslimat"
                      value={app.hasOwnCourier ? "Kendi kuryesi" : "Sofra kuryesi"}
                    />
                    <ApplicationFact
                      label="Şube"
                      value={`${app.branchCount} adet`}
                      tabular
                    />
                    {app.taxNumber && (
                      <ApplicationFact
                        label="Vergi / T.C. no"
                        value={app.taxNumber}
                        tabular
                      />
                    )}
                    {app.monthlyOrders && (
                      <ApplicationFact
                        label="Aylık tahmin"
                        value={app.monthlyOrders}
                      />
                    )}
                    {app.note && (
                      <ApplicationFact
                        label="Not"
                        value={app.note}
                        className="sm:col-span-2 lg:col-span-3"
                      />
                    )}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Komisyon oranı */}
      {commissionFor && (
        <CommissionModal
          row={commissionFor}
          onClose={() => setCommissionFor(null)}
          onSubmit={async (rate) => {
            await act(
              commissionFor,
              { action: "commission", rate },
              `${commissionFor.restaurant.name} komisyonu %${Math.round(rate * 100)} oldu.`
            );
            setCommissionFor(null);
          }}
        />
      )}

      {/* Panel kurulum bağlantısı */}
      {invite && (
        <Modal
          open
          onClose={() => setInvite(null)}
          title="Panel kurulum bağlantısı"
          description={`${invite.restaurant} için tek kullanımlık bağlantı · ${new Date(invite.expiresAt).toLocaleDateString("tr-TR")} tarihine kadar geçerli`}
          size="sm"
          footer={
            <Button block onClick={() => setInvite(null)}>
              Tamam
            </Button>
          }
        >
          <p className="text-sm text-muted">
            {invite.delivered
              ? `Bağlantı ${invite.email} adresine e-postayla gönderildi.`
              : `E-posta sağlayıcısı bağlı değil (test modu). Bağlantıyı ${invite.email} adresine sen ilet:`}
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-2.5">
            <code className="min-w-0 flex-1 truncate text-xs text-ink">
              {typeof window === "undefined" ? invite.setupPath : window.location.origin + invite.setupPath}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(window.location.origin + invite.setupPath);
                toast.success("Bağlantı kopyalandı.");
              }}
            >
              <Copy className="size-3.5" />
              Kopyala
            </Button>
          </div>
        </Modal>
      )}

      {/* Askıya alma */}
      {suspendFor && (
        <SuspendModal
          row={suspendFor}
          onClose={() => setSuspendFor(null)}
          onSubmit={async (reason) => {
            await act(
              suspendFor,
              { action: "suspend", reason },
              `${suspendFor.restaurant.name} askıya alındı.`
            );
            setSuspendFor(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CommissionModal({
  row,
  onClose,
  onSubmit,
}: {
  row: AdminRestaurantRow;
  onClose: () => void;
  onSubmit: (rate: number) => void;
}) {
  const [percent, setPercent] = useState(
    Math.round(row.restaurant.commissionRate * 100)
  );
  const sample = 1000;

  return (
    <Modal
      open
      onClose={onClose}
      title="Komisyon oranı"
      description={`${row.restaurant.name} için platform komisyonu`}
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" block onClick={onClose}>
            Vazgeç
          </Button>
          <Button block onClick={() => onSubmit(percent / 100)}>
            Kaydet
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <Field label={`Oran — %${percent}`} hint="%0 ile %40 arasında.">
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="w-full accent-[var(--brand)]"
          />
        </Field>

        <div className="tabular rounded-xl bg-surface-2 p-3.5 text-sm">
          <p className="text-muted">
            Örnek: {formatPrice(sample)} ciroda
          </p>
          <div className="mt-2 flex justify-between font-semibold">
            <span className="text-ink">Restoran hakedişi</span>
            <span className="text-pistachio">
              {formatPrice(sample * (1 - percent / 100))}
            </span>
          </div>
          <div className="mt-1 flex justify-between font-semibold">
            <span className="text-ink">Platform komisyonu</span>
            <span className="text-brand">
              {formatPrice(sample * (percent / 100))}
            </span>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted">
          Değişiklik restoranın Finans ekranına anında yansır. Onaylanmış
          hakedişlerin tutarı geriye dönük değişmez.
        </p>
      </div>
    </Modal>
  );
}

function SuspendModal({
  row,
  onClose,
  onSubmit,
}: {
  row: AdminRestaurantRow;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      open
      onClose={onClose}
      title="Restoranı askıya al"
      description={`${row.restaurant.name} müşteri uygulamasından kaldırılacak ve sipariş alamayacak.`}
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" block onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="danger" block onClick={() => onSubmit(reason)}>
            Askıya al
          </Button>
        </div>
      }
    >
      <Field label="Gerekçe" hint="İz kaydına yazılır." className="pt-1">
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder="Hijyen şikâyeti, yüksek iptal oranı, sözleşme ihlali…"
          autoFocus
        />
      </Field>
    </Modal>
  );
}

export { Store };

/** Başvuru formundan gelen tek bir bilgi satırı. */
function ApplicationFact({
  label,
  value,
  tabular,
  className,
}: {
  label: string;
  value: string;
  tabular?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 break-words text-text",
          tabular && "tabular"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

"use client";

import { Ban, Check, PlusCircle, Search, ShieldOff, Star, UserRoundSearch } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { AdminCourierRow, AdminUserRow } from "@/lib/services/admin";
import { useAdmin } from "@/lib/store/admin";
import { useDebounced } from "@/lib/hooks";
import { cn, formatDateTime, formatPhone, formatPrice } from "@/lib/utils";
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

type Tab = "users" | "couriers";

const COURIER_STATUS = {
  pending: {
    label: "Aktivasyon bekliyor",
    className: "bg-saffron-soft text-saffron",
  },
  active: { label: "Aktif", className: "bg-pistachio-soft text-pistachio" },
  suspended: { label: "Askıda", className: "bg-danger-soft text-danger" },
} as const;

/**
 * Kullanıcı ve kurye yönetimi.
 *
 * Müşteri tarafında kara liste ve manuel bakiye işlemleri, kurye tarafında
 * aktivasyon akışı. Askıya alınan kurye derhal mesaiden düşer; kara listeye
 * alınan müşteri giriş yapamaz ve sipariş veremez.
 */
export function AccountsPanel() {
  const toast = useToast();
  const setKpi = useAdmin((s) => s.setKpi);

  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [couriers, setCouriers] = useState<AdminCourierRow[] | null>(null);
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 300);

  const [blockFor, setBlockFor] = useState<AdminUserRow | null>(null);
  const [creditFor, setCreditFor] = useState<AdminUserRow | null>(null);
  const [suspendFor, setSuspendFor] = useState<AdminCourierRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ rows: AdminUserRow[] }>(
        `/admin/users${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`
      )
      .then((data) => setUsers(data.rows))
      .catch((err) => {
        toast.error(errorMessage(err));
        setUsers([]);
      });
  }, [debounced, toast]);

  useEffect(() => {
    api
      .get<{ rows: AdminCourierRow[] }>("/admin/couriers")
      .then((data) => setCouriers(data.rows))
      .catch(() => setCouriers([]));
  }, []);

  async function refreshKpi() {
    try {
      const me = await api.get<{ kpi: Parameters<typeof setKpi>[0] }>(
        "/admin/auth/me"
      );
      setKpi(me.kpi);
    } catch {
      /* sessizce geç */
    }
  }

  async function userAction(
    row: AdminUserRow,
    body: Record<string, unknown>,
    message: string
  ) {
    setBusyId(row.user.id);
    try {
      const data = await api.post<{ rows: AdminUserRow[] }>(
        `/admin/users/${row.user.id}`,
        body
      );
      setUsers(data.rows);
      toast.success(message);
      void refreshKpi();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function courierAction(
    row: AdminCourierRow,
    body: Record<string, unknown>,
    message: string
  ) {
    setBusyId(row.courier.id);
    try {
      const data = await api.post<{ rows: AdminCourierRow[] }>(
        `/admin/couriers/${row.courier.id}`,
        body
      );
      setCouriers(data.rows);
      toast.success(message);
      void refreshKpi();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-ink">
          Kullanıcılar
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          Müşteri hesapları, kara liste, manuel bakiye ve kurye aktivasyonu.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {(
            [
              ["users", `Müşteriler${users ? ` (${users.length})` : ""}`],
              ["couriers", `Kuryeler${couriers ? ` (${couriers.length})` : ""}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                tab === id
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "users" && (
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-brand sm:max-w-xs">
            <Search className="size-4 shrink-0 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ad, e-posta veya telefon"
              aria-label="Kullanıcı ara"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
            />
          </label>
        )}
      </div>

      {/* Müşteriler */}
      {tab === "users" &&
        (!users ? (
          <Skeleton className="h-64 w-full" />
        ) : users.length === 0 ? (
          <EmptyState icon={UserRoundSearch} title="Eşleşen kullanıcı yok" />
        ) : (
          <ul className="space-y-2.5">
            {users.map((row) => {
              const u = row.user;
              const busy = busyId === u.id;
              return (
                <li
                  key={u.id}
                  className={cn(
                    "card flex flex-wrap items-center gap-3 p-4",
                    u.blocked && "border-danger/40 bg-danger-soft/40"
                  )}
                >
                  <Avatar name={u.name} className="size-11 text-sm" />

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-bold text-ink">
                        {u.name}
                      </span>
                      {u.blocked && (
                        <span className="shrink-0 rounded-md bg-danger px-2 py-0.5 text-[11px] font-bold text-white">
                          Kara listede
                        </span>
                      )}
                    </p>
                    <p className="tabular truncate text-xs text-muted">
                      {u.phone ? formatPhone(u.phone) : u.email ?? "—"}
                      {row.lastOrderAt
                        ? ` · son sipariş ${formatDateTime(row.lastOrderAt)}`
                        : " · henüz sipariş yok"}
                    </p>
                    {u.blocked && u.blockReason && (
                      <p className="mt-1 text-xs italic text-danger">
                        {u.blockReason}
                      </p>
                    )}
                  </div>

                  <div className="tabular hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-bold text-ink">
                      {formatPrice(row.spent)}
                    </p>
                    <p className="text-[11px] text-muted">
                      {row.orders} sipariş · cüzdan{" "}
                      {formatPrice(u.walletBalance)}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setCreditFor(row)}
                    >
                      <PlusCircle className="size-3.5" />
                      Bakiye
                    </Button>
                    {u.blocked ? (
                      <Button
                        size="sm"
                        loading={busy}
                        onClick={() =>
                          userAction(
                            row,
                            { action: "unblock" },
                            `${u.name} kara listeden çıkarıldı.`
                          )
                        }
                      >
                        <Check className="size-3.5" />
                        Aç
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setBlockFor(row)}
                      >
                        <Ban className="size-3.5" />
                        Engelle
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

      {/* Kuryeler */}
      {tab === "couriers" &&
        (!couriers ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ul className="space-y-2.5">
            {couriers.map((row) => {
              const c = row.courier;
              const status = COURIER_STATUS[c.status];
              const busy = busyId === c.id;

              return (
                <li
                  key={c.id}
                  className={cn(
                    "card flex flex-wrap items-center gap-3 p-4",
                    c.status === "pending" && "border-saffron/40"
                  )}
                >
                  <Avatar name={c.name} className="size-11 text-sm" />

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-bold text-ink">
                        {c.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold",
                          status.className
                        )}
                      >
                        {status.label}
                      </span>
                      {c.online && (
                        <span className="shrink-0 rounded-md bg-info-soft px-2 py-0.5 text-[11px] font-bold text-info">
                          {row.busy ? "Teslimatta" : "Mesaide"}
                        </span>
                      )}
                    </p>
                    <p className="tabular truncate text-xs text-muted">
                      {formatPhone(c.phone)} ·{" "}
                      <Star className="inline size-3 -translate-y-px fill-saffron text-saffron" aria-hidden />{" "}
                      {c.rating.toFixed(1)} ·{" "}
                      {c.vehicle === "moto"
                        ? "Motosiklet"
                        : c.vehicle === "bisiklet"
                          ? "Bisiklet"
                          : "Araç"}
                    </p>
                  </div>

                  <div className="tabular hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-bold text-ink">
                      {formatPrice(row.earnings)}
                    </p>
                    <p className="text-[11px] text-muted">
                      {row.deliveries} teslimat · toplam {c.totalDeliveries}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    {c.status !== "active" ? (
                      <Button
                        size="sm"
                        loading={busy}
                        onClick={() =>
                          courierAction(
                            row,
                            { action: "activate" },
                            `${c.name} aktifleştirildi.`
                          )
                        }
                      >
                        <Check className="size-3.5" />
                        Aktifleştir
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setSuspendFor(row)}
                      >
                        <ShieldOff className="size-3.5" />
                        Askıya al
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

      {/* Kara liste */}
      {blockFor && (
        <ReasonModal
          title="Kullanıcıyı kara listeye al"
          description={`${blockFor.user.name} giriş yapamayacak ve sipariş veremeyecek.`}
          placeholder="Sahte sipariş, kurye tacizi, ödeme itirazı…"
          confirmLabel="Engelle"
          danger
          onClose={() => setBlockFor(null)}
          onSubmit={async (reason) => {
            await userAction(
              blockFor,
              { action: "block", reason },
              `${blockFor.user.name} kara listeye alındı.`
            );
            setBlockFor(null);
          }}
        />
      )}

      {/* Kurye askıya alma */}
      {suspendFor && (
        <ReasonModal
          title="Kuryeyi askıya al"
          description={`${suspendFor.courier.name} mesaiden düşürülecek ve sipariş alamayacak.`}
          placeholder="Düşük puan, teslimat ihlali, belge eksiği…"
          confirmLabel="Askıya al"
          danger
          onClose={() => setSuspendFor(null)}
          onSubmit={async (reason) => {
            await courierAction(
              suspendFor,
              { action: "suspend", reason },
              `${suspendFor.courier.name} askıya alındı.`
            );
            setSuspendFor(null);
          }}
        />
      )}

      {/* Manuel bakiye */}
      {creditFor && (
        <CreditModal
          row={creditFor}
          onClose={() => setCreditFor(null)}
          onSubmit={async (amount, reason) => {
            await userAction(
              creditFor,
              { action: "credit", amount, reason },
              `${creditFor.user.name} bakiyesi ${amount > 0 ? "+" : ""}${amount} ₺ güncellendi.`
            );
            setCreditFor(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ReasonModal({
  title,
  description,
  placeholder,
  confirmLabel,
  danger,
  onClose,
  onSubmit,
}: {
  title: string;
  description: string;
  placeholder: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" block onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            block
            onClick={() => onSubmit(reason)}
          >
            {confirmLabel}
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
          placeholder={placeholder}
          autoFocus
        />
      </Field>
    </Modal>
  );
}

const QUICK_AMOUNTS = [50, 100, 200, -50];

function CreditModal({
  row,
  onClose,
  onSubmit,
}: {
  row: AdminUserRow;
  onClose: () => void;
  onSubmit: (amount: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState(50);
  const [reason, setReason] = useState("");

  return (
    <Modal
      open
      onClose={onClose}
      title="Manuel bakiye işlemi"
      description={`${row.user.name} · mevcut bakiye ${formatPrice(row.user.walletBalance)}`}
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" block onClick={onClose}>
            Vazgeç
          </Button>
          <Button block onClick={() => onSubmit(amount, reason)}>
            {amount > 0 ? "Bakiye yükle" : "Bakiye düş"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(value)}
              className={cn(
                "tabular rounded-xl border px-3.5 py-2 text-sm font-bold transition-colors",
                amount === value
                  ? "border-brand bg-brand text-brand-contrast"
                  : "border-border bg-surface text-ink hover:bg-surface-2"
              )}
            >
              {value > 0 ? "+" : ""}
              {value} ₺
            </button>
          ))}
        </div>

        <Field label="Tutar (₺)" hint="Negatif değer bakiyeden düşer.">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="tabular"
          />
        </Field>

        <Field label="Gerekçe" hint="İz kaydına yazılır.">
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={160}
            placeholder="Gecikme tazminatı, eksik ürün iadesi, jest…"
          />
        </Field>

        <p className="tabular rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-muted">
          İşlem sonrası bakiye:{" "}
          <span className="font-bold text-ink">
            {formatPrice(Math.max(0, row.user.walletBalance + amount))}
          </span>
        </p>
      </div>
    </Modal>
  );
}

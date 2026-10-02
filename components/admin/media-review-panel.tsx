"use client";

import { ArrowRight, Check, ExternalLink, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { AdminMediaRow } from "@/lib/services/media";
import { useAdmin } from "@/lib/store/admin";
import { cn, relativeTime } from "@/lib/utils";
import { FoodImage } from "@/components/ui/food-image";
import { Modal } from "@/components/ui/modal";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";
import { RestaurantThumb } from "@/components/ui/restaurant-thumb";
import { useToast } from "@/components/ui/toast";

type Tab = "pending" | "decided";

/** Sık kullanılan ret gerekçeleri — tek dokunuşla doldurulur. */
const QUICK_REASONS = [
  "Fotoğraf ürünle uyuşmuyor",
  "Bulanık ya da düşük çözünürlüklü",
  "Yazı, logo veya filigran içeriyor",
  "Başka bir kaynaktan alınmış olabilir (telif)",
  "Uygunsuz içerik",
];

/**
 * Görsel onayları.
 *
 * Restoranların panelden gönderdiği kapak ve ürün fotoğrafları burada
 * sıraya girer. Yönetici yayındaki fotoğrafla yenisini yan yana görür:
 * onaylarsa fotoğraf müşteri sitesine anında işlenir, reddederse gerekçesi
 * restoran panelinde görünür. Kararlar iz kaydına yazılır.
 */
export function MediaReviewPanel() {
  const toast = useToast();
  const setKpi = useAdmin((s) => s.setKpi);

  const [rows, setRows] = useState<AdminMediaRow[] | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<AdminMediaRow | null>(null);

  const refreshKpi = useCallback(() => {
    api
      .get<{ kpi: Parameters<typeof setKpi>[0] }>("/admin/auth/me")
      .then((me) => setKpi(me.kpi))
      .catch(() => undefined);
  }, [setKpi]);

  useEffect(() => {
    api
      .get<{ rows: AdminMediaRow[] }>("/admin/media")
      .then((data) => {
        setRows(data.rows);
        refreshKpi();
      })
      .catch((err) => {
        toast.error(errorMessage(err));
        setRows([]);
      });
  }, [toast, refreshKpi]);

  async function decide(
    row: AdminMediaRow,
    body: { action: "approve" } | { action: "reject"; reason: string },
    message: string
  ) {
    setBusyId(row.request.id);
    try {
      const data = await api.post<{ rows: AdminMediaRow[] }>(
        `/admin/media/${row.request.id}`,
        body
      );
      setRows(data.rows);
      toast.success(message);
      refreshKpi();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  if (!rows) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const pending = rows.filter((r) => r.request.status === "pending");
  const decided = rows.filter((r) => r.request.status !== "pending");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-ink">
          Görsel onayları
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          Restoranların gönderdiği kapak ve ürün fotoğrafları. Onaylanan
          fotoğraf müşteri sitesine anında işlenir.
        </p>
      </header>

      <div className="flex gap-1 rounded-xl bg-surface-2 p-1 sm:inline-flex">
        {(
          [
            ["pending", "Onay bekleyen", pending.length],
            ["decided", "Sonuçlanan", decided.length],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:flex-none",
              tab === id
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink"
            )}
          >
            {label}
            <span className="tabular ml-1.5 text-xs text-muted">{count}</span>
          </button>
        ))}
      </div>

      {tab === "pending" ? (
        pending.length === 0 ? (
          <EmptyState
            emoji="🖼️"
            title="Onay bekleyen fotoğraf yok"
            description="Restoranlar panelden kapak ya da ürün fotoğrafı gönderdiğinde burada sıraya girer."
          />
        ) : (
          <ul className="max-w-4xl space-y-3">
            {pending.map((row) => (
              <PendingCard
                key={row.request.id}
                row={row}
                busy={busyId === row.request.id}
                onApprove={() =>
                  decide(
                    row,
                    { action: "approve" },
                    `${row.restaurant.name} · ${row.request.targetName} yayına alındı.`
                  )
                }
                onReject={() => setRejectFor(row)}
              />
            ))}
          </ul>
        )
      ) : decided.length === 0 ? (
        <EmptyState
          emoji="🗂️"
          title="Henüz karar verilmiş fotoğraf yok"
          description="Onaylanan ve reddedilen fotoğraflar burada listelenir."
        />
      ) : (
        <ul className="max-w-4xl space-y-2">
          {decided.map((row) => (
            <DecidedRow key={row.request.id} row={row} />
          ))}
        </ul>
      )}

      {rejectFor && (
        <RejectModal
          row={rejectFor}
          busy={busyId === rejectFor.request.id}
          onClose={() => setRejectFor(null)}
          onSubmit={async (reason) => {
            const done = await decide(
              rejectFor,
              { action: "reject", reason },
              `${rejectFor.restaurant.name} · ${rejectFor.request.targetName} reddedildi.`
            );
            if (done) setRejectFor(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function targetLabel(row: AdminMediaRow) {
  return row.request.target.kind === "cover"
    ? "Kapak fotoğrafı"
    : `Ürün · ${row.request.targetName}`;
}

function PendingCard({
  row,
  busy,
  onApprove,
  onReject,
}: {
  row: AdminMediaRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { request, restaurant } = row;
  const aspect =
    request.target.kind === "cover" ? "aspect-[16/9]" : "aspect-[4/3]";

  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <RestaurantThumb
          image={restaurant.image}
          emoji={restaurant.emoji}
          className="size-11 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-[15px] font-extrabold text-ink">
            {restaurant.name}
          </p>
          <p className="truncate text-xs text-muted">
            {targetLabel(row)} · {relativeTime(request.createdAt)}
          </p>
        </div>
        <Badge tone={request.target.kind === "cover" ? "info" : "neutral"}>
          {request.target.kind === "cover" ? "Kapak" : "Ürün"}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <figure className="min-w-0">
          {row.currentImage ? (
            <FoodImage
              seed={request.id}
              emoji={restaurant.emoji}
              src={row.currentImage}
              alt="Yayındaki fotoğraf"
              className={cn("w-full", aspect)}
              sizes="(min-width: 1024px) 360px, 40vw"
            />
          ) : (
            <div
              className={cn(
                "flex items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-2 px-3 text-center text-xs text-muted",
                aspect
              )}
            >
              Yayında fotoğraf yok
            </div>
          )}
          <figcaption className="mt-1.5 text-xs font-semibold text-muted">
            Şu an yayında
          </figcaption>
        </figure>

        <ArrowRight className="size-5 text-muted" aria-hidden />

        <figure className="min-w-0">
          {/* Onay bekleyen fotoğraf herkese açık değil: optimize edilmeden,
              yönetici çereziyle yüklenir. Tam boyu yeni sekmede açılır. */}
          <a
            href={request.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "group relative block overflow-hidden rounded-xl bg-surface-2 ring-2 ring-saffron/60",
              aspect
            )}
          >
            <img
              src={request.url}
              alt={`${restaurant.name} için gönderilen fotoğraf`}
              className="size-full object-cover"
            />
            <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <ExternalLink className="size-3.5" />
            </span>
          </a>
          <figcaption className="tabular mt-1.5 text-xs font-semibold text-saffron">
            Yeni · {request.width}×{request.height} ·{" "}
            {Math.max(1, Math.round(request.bytes / 1024))} KB
          </figcaption>
        </figure>
      </div>

      {!row.targetExists && (
        <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
          Bu ürün menüden kaldırılmış; fotoğraf uygulanamaz. Talebi
          reddedebilirsin.
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={onReject}>
          <X className="size-4" />
          Reddet
        </Button>
        <Button
          size="sm"
          loading={busy}
          disabled={!row.targetExists}
          onClick={onApprove}
        >
          <Check className="size-4" />
          Onayla ve yayınla
        </Button>
      </div>
    </li>
  );
}

function DecidedRow({ row }: { row: AdminMediaRow }) {
  const { request, restaurant } = row;
  const approved = request.status === "approved";

  return (
    <li className="card flex items-center gap-3 p-3">
      <a
        href={request.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2"
      >
        <img src={request.url} alt="" className="size-full object-cover" />
      </a>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">
          {restaurant.name}
          <span className="font-medium text-muted"> · {targetLabel(row)}</span>
        </p>
        <p className="truncate text-xs text-muted">
          {request.decidedBy}
          {request.decidedAt && ` · ${relativeTime(request.decidedAt)}`}
          {request.rejectReason && ` · “${request.rejectReason}”`}
        </p>
      </div>
      <Badge tone={approved ? "success" : "danger"}>
        {approved ? "Onaylandı" : "Reddedildi"}
      </Badge>
    </li>
  );
}

function RejectModal({
  row,
  busy,
  onClose,
  onSubmit,
}: {
  row: AdminMediaRow;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      open
      onClose={onClose}
      title="Fotoğrafı reddet"
      description={`${row.restaurant.name} · ${targetLabel(row)}. Gerekçe restoran panelinde görünür.`}
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" block onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            variant="danger"
            block
            loading={busy}
            disabled={reason.trim().length < 3}
            onClick={() => onSubmit(reason)}
          >
            Reddet
          </Button>
        </div>
      }
    >
      <div className="space-y-3 pt-1">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REASONS.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => setReason(text)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                reason === text
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border bg-surface text-ink hover:bg-surface-2"
              )}
            >
              {text}
            </button>
          ))}
        </div>
        <Field label="Gerekçe" hint="İz kaydına da yazılır.">
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="Restoran neyi düzeltmeli?"
            autoFocus
          />
        </Field>
      </div>
    </Modal>
  );
}

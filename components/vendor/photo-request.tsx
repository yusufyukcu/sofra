"use client";

import { Clock, ImageUp, RotateCcw, Trash2, XCircle } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { MediaRequest, MediaTarget } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { FoodImage } from "@/components/ui/food-image";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/**
 * Restoran panelinde fotoğraf gönderme.
 *
 * Seçilen fotoğraf doğrudan yayına girmez: yönetici onayına gider. Alan,
 * yayındaki fotoğrafla onay bekleyeni yan yana gösterir; reddedilen son
 * fotoğrafın gerekçesini de taşır. Ürün henüz kaydedilmemişse fotoğraf
 * bekletilir, ürün eklenince onaya gönderilir.
 */

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_MB = 5;

const RATIO = {
  cover: { className: "aspect-[16/9]", label: "16:9" },
  product: { className: "aspect-[4/3]", label: "4:3" },
} as const;

/** İstemci tarafı ön kontrol — sunucu dosyayı yine de çözerek doğrular. */
export function photoFileError(file: File): string | null {
  if (!PHOTO_ACCEPT.split(",").includes(file.type)) {
    return "JPEG, PNG ya da WebP bir fotoğraf seç.";
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return `Fotoğraf en fazla ${MAX_MB} MB olabilir.`;
  }
  return null;
}

/** Fotoğrafı onaya gönderir; restoranın güncel talep listesini döndürür. */
export async function sendPhoto(
  target: MediaTarget,
  file: File
): Promise<MediaRequest[]> {
  const form = new FormData();
  form.set("kind", target.kind);
  if (target.kind === "product") form.set("productId", target.productId);
  form.set("file", file);
  const data = await api.upload<{ requests: MediaRequest[] }>(
    "/vendor/media",
    form
  );
  return data.requests;
}

/** Hedefin en yeni talebi (liste en yenisi başta gelir). */
export function latestFor(
  requests: MediaRequest[],
  target: MediaTarget
): MediaRequest | undefined {
  return requests.find((r) =>
    target.kind === "cover"
      ? r.target.kind === "cover"
      : r.target.kind === "product" && r.target.productId === target.productId
  );
}

export function PhotoRequestField({
  target,
  shape,
  currentImage,
  seed,
  emoji,
  tone,
  requests,
  onRequestsChange,
  deferredFile = null,
  onDeferredFileChange,
}: {
  /** Yeni üründe henüz yok: fotoğraf ürün kaydedilince gönderilir */
  target: MediaTarget | null;
  shape: "cover" | "product";
  /** Müşterinin şu an gördüğü fotoğraf */
  currentImage?: string;
  seed: string;
  emoji: string;
  tone?: string;
  requests: MediaRequest[];
  onRequestsChange: (requests: MediaRequest[]) => void;
  deferredFile?: File | null;
  onDeferredFileChange?: (file: File | null) => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const latest = target ? latestFor(requests, target) : undefined;
  const pending = latest?.status === "pending" ? latest : undefined;
  const rejected = latest?.status === "rejected" ? latest : undefined;
  const ratio = RATIO[shape];

  // Bekletilen dosyanın önizlemesi
  useEffect(() => {
    if (!deferredFile) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(deferredFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [deferredFile]);

  async function pick(file: File | undefined) {
    if (!file) return;
    const problem = photoFileError(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (!target) {
      onDeferredFileChange?.(file);
      return;
    }
    setBusy(true);
    try {
      onRequestsChange(await sendPhoto(target, file));
      toast.success("Fotoğraf onaya gönderildi. Yönetici onaylayınca yayına girer.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(request: MediaRequest) {
    setBusy(true);
    try {
      const data = await api.delete<{ requests: MediaRequest[] }>(
        `/vendor/media/${request.id}`
      );
      onRequestsChange(data.requests);
      toast.success("Fotoğraf talebi geri çekildi.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!busy) void pick(e.dataTransfer.files[0]);
  }

  const waiting = pending ?? (preview ? "deferred" : null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Yayındaki fotoğraf */}
        <figure className="min-w-0">
          <FoodImage
            seed={seed}
            emoji={emoji}
            tone={tone}
            src={currentImage}
            alt="Yayındaki fotoğraf"
            className={cn("w-full", ratio.className)}
            emojiClassName="text-4xl"
            sizes="(min-width: 1024px) 320px, 45vw"
          />
          <figcaption className="mt-1.5 text-xs font-semibold text-muted">
            {currentImage ? "Yayında" : "Fotoğraf yok — renkli çizim görünüyor"}
          </figcaption>
        </figure>

        {/* Onay bekleyen ya da yükleme alanı */}
        {waiting ? (
          <figure className="min-w-0">
            <div
              className={cn(
                "relative overflow-hidden rounded-xl bg-surface-2 ring-2 ring-saffron/60",
                ratio.className
              )}
            >
              {/* Onay bekleyen fotoğraf herkese açık değil; optimize
                  edilmeden, oturum çereziyle doğrudan yüklenir */}
              <img
                src={pending ? pending.url : (preview ?? "")}
                alt="Onaya gönderilen fotoğraf"
                className="size-full object-cover"
              />
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-saffron px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                <Clock className="size-3" />
                {pending ? "Onay bekliyor" : "Kayıtla gönderilecek"}
              </span>
            </div>
            <figcaption className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted">
              <span className="truncate">
                {pending
                  ? `Gönderildi · ${relativeTime(pending.createdAt)}`
                  : "Ürünü eklediğinde onaya gider"}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  pending ? void withdraw(pending) : onDeferredFileChange?.(null)
                }
                className="inline-flex shrink-0 items-center gap-1 font-semibold text-muted transition-colors hover:text-danger disabled:opacity-50"
              >
                {pending ? (
                  <RotateCcw className="size-3.5" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                {pending ? "Geri çek" : "Kaldır"}
              </button>
            </figcaption>
          </figure>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 text-center transition-colors disabled:opacity-60",
              ratio.className,
              dragging
                ? "border-brand bg-brand-soft"
                : "border-border-strong bg-surface hover:border-brand hover:bg-brand-soft"
            )}
          >
            <ImageUp className="size-6 text-brand" />
            <span className="text-sm font-bold text-ink">
              {busy ? "Gönderiliyor…" : "Fotoğraf yükle"}
            </span>
            <span className="text-[11px] leading-snug text-muted">
              Sürükle bırak ya da seç
            </span>
          </button>
        )}
      </div>

      {rejected && !waiting && (
        <div className="flex gap-3 rounded-xl border border-danger/25 bg-danger-soft p-3">
          <img
            src={rejected.url}
            alt=""
            className="size-12 shrink-0 rounded-lg object-cover opacity-80"
          />
          <div className="min-w-0 text-sm">
            <p className="flex items-center gap-1.5 font-bold text-danger">
              <XCircle className="size-4" />
              Son gönderdiğin fotoğraf reddedildi
            </p>
            <p className="mt-0.5 text-muted">
              {rejected.rejectReason}
              {rejected.decidedAt && ` · ${relativeTime(rejected.decidedAt)}`}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-relaxed text-muted">
          JPEG, PNG ya da WebP · en fazla {MAX_MB} MB · {ratio.label} oranına
          kırpılır. Yönetici onaylayınca müşteri sitesinde görünür.
        </p>
        {waiting && (
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() => inputRef.current?.click()}
          >
            <ImageUp className="size-4" />
            Başka fotoğraf seç
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          // Aynı dosya tekrar seçilince de değişiklik tetiklensin
          e.target.value = "";
        }}
      />
    </div>
  );
}

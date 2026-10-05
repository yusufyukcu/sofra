"use client";

import { ChevronDown, Crosshair, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/api-client";
import { addressLabelIcon } from "@sofra/core";
import { DEFAULT_CENTER } from "@/lib/constants";
import { Icon } from "@/components/ui/icon";
import { QUICK_LOCATIONS, currentPosition, reverseGeocode } from "@/lib/geocode";
import {
  deliveryLabel,
  deliveryPoint,
  useSession,
} from "@/lib/store/session";
import type { LatLng } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AddressForm } from "@/components/account/address-form";
import { PickerMap } from "@/components/map";
import { Button, Chip } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/**
 * Başlıktaki teslimat adresi seçici.
 *
 * Giriş yapmış kullanıcı kayıtlı adresleri arasından seçer veya yeni adres
 * ekler; misafir kullanıcı haritadan bir konum işaretler (restoranlar yine
 * de konuma göre filtrelenebilsin diye).
 */
export function AddressSelector({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const label = useSession(deliveryLabel);
  const status = useSession((s) => s.status);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex min-w-0 items-center gap-2 rounded-full py-1.5 pl-2 pr-3 text-left transition-colors hover:bg-surface-2",
          compact ? "max-w-[46vw]" : "max-w-xs"
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <MapPin className="size-4" />
        </span>
        <span className="min-w-0">
          <span
            className={cn(
              "block text-xs leading-tight text-muted",
              compact && "hidden sm:block"
            )}
          >
            Teslimat adresi
          </span>
          <span
            className={cn(
              "block truncate text-sm font-bold leading-tight text-ink"
            )}
          >
            {status === "loading" ? "Yükleniyor…" : label}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted transition-transform group-hover:translate-y-0.5"
          )}
        />
      </button>

      <AddressSelectorModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AddressSelectorModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const status = useSession((s) => s.status);
  const addresses = useSession((s) => s.addresses);
  const selectedId = useSession((s) => s.selectedAddressId);
  const selectAddress = useSession((s) => s.selectAddress);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) setAdding(false);
  }, [open]);

  if (status !== "authenticated") {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Nereye teslim edelim?"
        description="Sana en yakın restoranları göstermek için konumunu seç."
        size="md"
      >
        <GuestLocationPicker onDone={onClose} />
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={adding ? "Yeni adres ekle" : "Adreslerim"}
      description={
        adding
          ? "Haritadan konumunu işaretle, gerisini biz dolduralım."
          : "Siparişini hangi adrese getirelim?"
      }
      size={adding ? "lg" : "md"}
    >
      {adding ? (
        <AddressForm
          onSaved={(address) => {
            selectAddress(address.id);
            onClose();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="space-y-2">
          {addresses.map((address) => {
            const active = address.id === selectedId;
            return (
              <button
                key={address.id}
                type="button"
                onClick={() => {
                  selectAddress(address.id);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors",
                  active
                    ? "border-brand bg-brand-soft"
                    : "border-border bg-surface hover:bg-surface-2"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    active ? "bg-brand text-brand-contrast" : "bg-surface-2 text-muted"
                  )}
                  aria-hidden
                >
                  <Icon name={addressLabelIcon(address.label)} className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-text">{address.title}</span>
                    {address.isDefault && (
                      <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted">
                        Varsayılan
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {address.line1}
                  </span>
                  <span className="block text-xs text-muted">
                    {address.district} / {address.city}
                  </span>
                </span>
                {active && (
                  <span className="mt-1 size-2.5 shrink-0 rounded-full bg-brand" />
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong p-3.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
          >
            <Plus className="size-4" />
            Yeni adres ekle
          </button>

          <Link
            href="/hesabim/adreslerim"
            onClick={onClose}
            className="block pt-1 text-center text-sm font-medium text-muted hover:text-text"
          >
            Adreslerimi yönet
          </Link>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Misafir konum seçici                                                */
/* ------------------------------------------------------------------ */

function GuestLocationPicker({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const initial = useSession(deliveryPoint);
  const setGuestLocation = useSession((s) => s.setGuestLocation);

  const [point, setPoint] = useState<LatLng>(initial ?? DEFAULT_CENTER);
  const [label, setLabel] = useState("Seçilen konum");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const result = await reverseGeocode(point, controller.signal);
      if (result) {
        setLabel(
          [result.neighbourhood, result.district].filter(Boolean).join(", ") ||
            result.line1 ||
            "Seçilen konum"
        );
      }
    }, 700);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [point]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border">
        <PickerMap value={point} onChange={setPoint} className="h-56 w-full" />
        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-2 px-3 py-2.5">
          <span className="truncate text-sm font-semibold text-text">{label}</span>
          <button
            type="button"
            disabled={locating}
            onClick={async () => {
              setLocating(true);
              try {
                setPoint(await currentPosition());
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setLocating(false);
              }
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-surface-3 disabled:opacity-60"
          >
            <Crosshair className="size-3.5" />
            {locating ? "Bulunuyor…" : "Konumumu kullan"}
          </button>
        </div>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {QUICK_LOCATIONS.map((q) => (
          <Chip key={q.name} onClick={() => setPoint(q.point)}>
            {q.name}
          </Chip>
        ))}
      </div>

      <Button
        block
        onClick={() => {
          setGuestLocation(point, label);
          onDone();
        }}
      >
        Bu konumu kullan
      </Button>

      <p className="text-center text-xs text-muted">
        Sipariş verebilmek için{" "}
        <Link href="/giris" className="font-semibold text-brand hover:underline">
          giriş yapman
        </Link>{" "}
        gerekiyor.
      </p>
    </div>
  );
}

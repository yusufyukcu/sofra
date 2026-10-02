"use client";

import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { ADDRESS_LABELS } from "@/lib/constants";
import { useSession } from "@/lib/store/session";
import type { Address } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { AddressForm } from "./address-form";

/** Adres defteri yönetimi. */
export function AddressList() {
  const toast = useToast();
  const addresses = useSession((s) => s.addresses);
  const setAddresses = useSession((s) => s.setAddresses);
  const selectedId = useSession((s) => s.selectedAddressId);
  const selectAddress = useSession((s) => s.selectAddress);

  const [editing, setEditing] = useState<Address | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Address | null>(null);

  async function makeDefault(address: Address) {
    try {
      const data = await api.post<{ addresses: Address[] }>(
        `/addresses/${address.id}/default`
      );
      setAddresses(data.addresses);
      selectAddress(address.id);
      toast.success(`"${address.title}" varsayılan adresin oldu.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function remove(address: Address) {
    try {
      const data = await api.delete<{ addresses: Address[] }>(
        `/addresses/${address.id}`
      );
      setAddresses(data.addresses);
      toast.success("Adres silindi.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Adreslerim</h1>
          <p className="mt-1 text-sm text-muted">
            Teslimat adreslerini yönet, varsayılanı belirle.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Yeni adres
        </Button>
      </header>

      {addresses.length === 0 ? (
        <EmptyState
          emoji="📍"
          title="Henüz adres eklemedin"
          description="Sipariş verebilmek için haritadan bir teslimat adresi işaretle."
          action={<Button onClick={() => setAdding(true)}>Adres ekle</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => {
            const meta = ADDRESS_LABELS.find((l) => l.id === address.label);
            const active = address.id === selectedId;
            return (
              <article
                key={address.id}
                className={cn(
                  "card p-4 transition-colors",
                  active && "border-brand"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl" aria-hidden>
                    {meta?.emoji ?? "📍"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="font-bold text-text">{address.title}</h2>
                      {address.isDefault && <Badge tone="brand">Varsayılan</Badge>}
                      {active && !address.isDefault && <Badge>Seçili</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted">{address.line1}</p>
                    <p className="text-xs text-muted">
                      {[
                        address.buildingNo && `No: ${address.buildingNo}`,
                        address.floor && `Kat: ${address.floor}`,
                        address.apartmentNo && `Daire: ${address.apartmentNo}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="text-xs text-muted">
                      {address.district} / {address.city}
                    </p>
                    {address.directions && (
                      <p className="mt-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs italic text-muted">
                        {address.directions}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  {!address.isDefault && (
                    <button
                      type="button"
                      onClick={() => makeDefault(address)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text"
                    >
                      <Star className="size-3.5" />
                      Varsayılan yap
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditing(address)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text"
                  >
                    <Pencil className="size-3.5" />
                    Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(address)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                    Sil
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={adding || Boolean(editing)}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        title={editing ? "Adresi düzenle" : "Yeni adres"}
        description="Haritadan konumunu işaretle, adres alanlarını otomatik dolduralım."
        size="lg"
      >
        <AddressForm
          key={editing?.id ?? "new"}
          initial={editing ?? undefined}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
          }}
          onCancel={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
        title="Adresi sil"
        description={`"${deleting?.title}" adresi kalıcı olarak silinecek.`}
        confirmLabel="Sil"
      />
    </div>
  );
}

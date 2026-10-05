"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type {
  MediaRequest,
  MenuCategory,
  OptionGroup,
  Product,
} from "@/lib/types";
import { cn, createId, formatPrice } from "@/lib/utils";
import { FoodImage } from "@/components/ui/food-image";
import { Modal } from "@/components/ui/modal";
import {
  Badge,
  Button,
  Field,
  Input,
  Switch,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { PhotoRequestField, sendPhoto } from "./photo-request";

interface Draft {
  id?: string;
  categoryId: string;
  name: string;
  description: string;
  emoji: string;
  price: string;
  oldPrice: string;
  popular: boolean;
  soldOut: boolean;
  optionGroups: OptionGroup[];
}

function toDraft(
  product: Product | null,
  categoryId: string
): Draft {
  if (!product) {
    return {
      categoryId,
      name: "",
      description: "",
      emoji: "🍽️",
      price: "",
      oldPrice: "",
      popular: false,
      soldOut: false,
      optionGroups: [],
    };
  }
  return {
    id: product.id,
    categoryId,
    name: product.name,
    description: product.description,
    emoji: product.emoji,
    price: String(product.price),
    oldPrice: product.oldPrice ? String(product.oldPrice) : "",
    popular: Boolean(product.popular),
    soldOut: Boolean(product.soldOut),
    optionGroups: structuredClone(product.optionGroups),
  };
}

/**
 * Ürün düzenleyici.
 *
 * Varyant ağacı da burada kurulur: tekli seçim (Boyut), çoklu seçim
 * (Malzemeler) ve ücretli ekstralar aynı yapıyla tanımlanır — müşteri
 * uygulamasındaki ürün ekranı bu ağacı olduğu gibi çizer.
 *
 * Fotoğraf ürün bilgileriyle birlikte kaydedilmez, yönetici onayına gider.
 * Mevcut üründe seçildiği an gönderilir; yeni üründe ürün eklenince.
 */
export function ProductEditor({
  open,
  onClose,
  product,
  categoryId,
  categories,
  onSaved,
  requests,
  onRequestsChange,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  categoryId: string;
  categories: MenuCategory[];
  onSaved: (menu: MenuCategory[]) => void;
  /** Restoranın fotoğraf talepleri */
  requests: MediaRequest[];
  onRequestsChange: (requests: MediaRequest[]) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => toDraft(product, categoryId));
  const [busy, setBusy] = useState(false);
  /** Yeni üründe ürünle birlikte gönderilecek fotoğraf */
  const [photo, setPhoto] = useState<File | null>(null);

  function patch(changes: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  /* ---------------- Opsiyon ağacı ---------------- */

  function addGroup() {
    patch({
      optionGroups: [
        ...draft.optionGroups,
        {
          id: createId("grp"),
          name: "",
          type: "single",
          required: true,
          options: [{ id: createId("opt"), name: "", priceDelta: 0, default: true }],
        },
      ],
    });
  }

  function updateGroup(groupId: string, changes: Partial<OptionGroup>) {
    patch({
      optionGroups: draft.optionGroups.map((group) =>
        group.id === groupId ? { ...group, ...changes } : group
      ),
    });
  }

  function removeGroup(groupId: string) {
    patch({
      optionGroups: draft.optionGroups.filter((group) => group.id !== groupId),
    });
  }

  function addOption(groupId: string) {
    patch({
      optionGroups: draft.optionGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: [
                ...group.options,
                { id: createId("opt"), name: "", priceDelta: 0 },
              ],
            }
          : group
      ),
    });
  }

  function updateOption(
    groupId: string,
    optionId: string,
    changes: Partial<OptionGroup["options"][number]>
  ) {
    patch({
      optionGroups: draft.optionGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.map((option) =>
                option.id === optionId ? { ...option, ...changes } : option
              ),
            }
          : group
      ),
    });
  }

  function removeOption(groupId: string, optionId: string) {
    patch({
      optionGroups: draft.optionGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.filter((option) => option.id !== optionId),
            }
          : group
      ),
    });
  }

  /* ---------------- Kayıt ---------------- */

  async function save() {
    setBusy(true);
    try {
      const data = await api.post<{ menu: MenuCategory[]; productId: string }>(
        "/vendor/menu/products",
        {
          action: "upsert",
          id: draft.id,
          categoryId: draft.categoryId,
          name: draft.name,
          description: draft.description,
          emoji: draft.emoji,
          price: Number(draft.price.replace(",", ".")),
          oldPrice: draft.oldPrice
            ? Number(draft.oldPrice.replace(",", "."))
            : null,
          popular: draft.popular,
          soldOut: draft.soldOut,
          optionGroups: draft.optionGroups,
        }
      );
      onSaved(data.menu);

      if (!draft.id && photo) {
        try {
          onRequestsChange(
            await sendPhoto({ kind: "product", productId: data.productId }, photo)
          );
          toast.success("Ürün menüye eklendi, fotoğrafı onaya gönderildi.");
        } catch (err) {
          // Ürün kaydedildi; fotoğraf düzenleme ekranından tekrar gönderilebilir
          toast.error(`Ürün eklendi ama fotoğraf gönderilemedi: ${errorMessage(err)}`);
        }
      } else {
        toast.success(draft.id ? "Ürün güncellendi." : "Ürün menüye eklendi.");
      }
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const priceNumber = Number(draft.price.replace(",", "."));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={draft.id ? "Ürünü düzenle" : "Yeni ürün"}
      description="Fiyat ve seçenekler kaydedildiği anda müşteri menüsüne yansır."
      size="lg"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" block onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            block
            size="lg"
            loading={busy}
            disabled={draft.name.trim().length < 2 || !Number.isFinite(priceNumber)}
            onClick={save}
          >
            {draft.id ? "Değişiklikleri kaydet" : "Ürünü ekle"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Fotoğraf — yönetici onayına gider */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Fotoğraf</h3>
          <PhotoRequestField
            target={draft.id ? { kind: "product", productId: draft.id } : null}
            shape="product"
            currentImage={product?.image}
            seed={draft.id ?? "yeni-urun"}
            requests={requests}
            onRequestsChange={onRequestsChange}
            deferredFile={photo}
            onDeferredFileChange={setPhoto}
          />
        </section>

        {/* Temel bilgiler */}
        <div>
          <div className="space-y-4">
            <Field label="Ürün adı" required>
              <Input
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Örn. Kasap Double Cheese"
                maxLength={60}
              />
            </Field>

            <Field label="Kategori">
              <select
                value={draft.categoryId}
                onChange={(e) => patch({ categoryId: e.target.value })}
                className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-[15px] text-ink focus:border-brand focus:outline-none"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <Field label="Açıklama" hint="Müşteri menüsünde ürünün altında görünür.">
          <Textarea
            rows={2}
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            maxLength={180}
            placeholder="İçindekiler, porsiyon bilgisi…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fiyat (₺)" required>
            <Input
              value={draft.price}
              onChange={(e) => patch({ price: e.target.value })}
              inputMode="decimal"
              placeholder="395"
              className="tabular"
            />
          </Field>
          <Field
            label="Eski fiyat (₺)"
            hint="Doldurursan üstü çizili gösterilir."
          >
            <Input
              value={draft.oldPrice}
              onChange={(e) => patch({ oldPrice: e.target.value })}
              inputMode="decimal"
              placeholder="460"
              className="tabular"
            />
          </Field>
        </div>

        <div className="space-y-2">
          <Switch
            checked={draft.popular}
            onChange={(v) => patch({ popular: v })}
            label="Popüler olarak işaretle"
            description="Menüde 'Popüler' rozetiyle öne çıkar."
          />
          <Switch
            checked={draft.soldOut}
            onChange={(v) => patch({ soldOut: v })}
            label="Şu an tükendi"
            description="Menüde görünür ama sipariş edilemez."
          />
        </div>

        {/* Varyant ağacı */}
        <section className="rounded-2xl border border-border bg-surface-2/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-extrabold text-ink">
                Seçenekler ve ekstralar
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                Boyut, pişirme derecesi, malzemeler, ücretli ekstralar…
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={addGroup}>
              <Plus className="size-4" />
              Grup ekle
            </Button>
          </div>

          {draft.optionGroups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
              Bu ürünün seçeneği yok. İstersen bir grup ekleyip boyut veya
              malzeme seçimi tanımlayabilirsin.
            </p>
          ) : (
            <div className="space-y-3">
              {draft.optionGroups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-xl border border-border bg-surface p-3.5"
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-2.5 size-4 shrink-0 text-muted/60" />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <Input
                          value={group.name}
                          onChange={(e) =>
                            updateGroup(group.id, { name: e.target.value })
                          }
                          placeholder="Grup adı (Boyut, Malzemeler…)"
                          maxLength={40}
                        />
                        <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
                          {(
                            [
                              ["single", "Tek seçim"],
                              ["multi", "Çok seçim"],
                            ] as const
                          ).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() =>
                                updateGroup(group.id, {
                                  type: value,
                                  required: value === "single",
                                  minSelect: undefined,
                                  maxSelect: undefined,
                                })
                              }
                              className={cn(
                                "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                                group.type === value
                                  ? "bg-surface text-ink shadow-sm"
                                  : "text-muted hover:text-ink"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        {group.type === "single" ? (
                          <label className="flex items-center gap-2 font-medium text-muted">
                            <input
                              type="checkbox"
                              checked={group.required}
                              onChange={(e) =>
                                updateGroup(group.id, {
                                  required: e.target.checked,
                                })
                              }
                              className="size-4 accent-[var(--brand)]"
                            />
                            Seçim zorunlu
                          </label>
                        ) : (
                          <>
                            <label className="flex items-center gap-1.5 font-medium text-muted">
                              En az
                              <input
                                type="number"
                                min={0}
                                max={10}
                                value={group.minSelect ?? 0}
                                onChange={(e) =>
                                  updateGroup(group.id, {
                                    minSelect: Number(e.target.value) || undefined,
                                  })
                                }
                                className="tabular h-8 w-14 rounded-lg border border-border bg-surface px-2 text-center text-ink"
                              />
                            </label>
                            <label className="flex items-center gap-1.5 font-medium text-muted">
                              En fazla
                              <input
                                type="number"
                                min={0}
                                max={20}
                                value={group.maxSelect ?? 0}
                                onChange={(e) =>
                                  updateGroup(group.id, {
                                    maxSelect: Number(e.target.value) || undefined,
                                  })
                                }
                                className="tabular h-8 w-14 rounded-lg border border-border bg-surface px-2 text-center text-ink"
                              />
                            </label>
                            <span className="text-muted/70">0 = sınırsız</span>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => removeGroup(group.id)}
                          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash2 className="size-3.5" />
                          Grubu sil
                        </button>
                      </div>

                      {/* Seçenekler */}
                      <div className="space-y-1.5">
                        {group.options.map((option) => (
                          <div
                            key={option.id}
                            className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 p-2"
                          >
                            <input
                              value={option.name}
                              onChange={(e) =>
                                updateOption(group.id, option.id, {
                                  name: e.target.value,
                                })
                              }
                              placeholder="Seçenek adı"
                              maxLength={40}
                              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
                            />
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={option.priceDelta}
                                onChange={(e) =>
                                  updateOption(group.id, option.id, {
                                    priceDelta: Number(e.target.value),
                                  })
                                }
                                className="tabular h-9 w-24 rounded-lg border border-border bg-surface px-2 text-right text-sm text-ink focus:border-brand focus:outline-none"
                              />
                              <span className="text-xs text-muted">₺ fark</span>
                            </div>

                            <label
                              title="Varsayılan seçili gelsin"
                              className="flex items-center gap-1.5 text-xs font-medium text-muted"
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(option.default)}
                                onChange={(e) =>
                                  updateOption(group.id, option.id, {
                                    default: e.target.checked,
                                  })
                                }
                                className="size-4 accent-[var(--brand)]"
                              />
                              Varsayılan
                            </label>

                            <label
                              title="Bu malzeme tükendi"
                              className="flex items-center gap-1.5 text-xs font-medium text-muted"
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(option.soldOut)}
                                onChange={(e) =>
                                  updateOption(group.id, option.id, {
                                    soldOut: e.target.checked,
                                  })
                                }
                                className="size-4 accent-[var(--danger)]"
                              />
                              Tükendi
                            </label>

                            <button
                              type="button"
                              onClick={() => removeOption(group.id, option.id)}
                              aria-label="Seçeneği sil"
                              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => addOption(group.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-brand transition-colors hover:bg-brand-soft"
                        >
                          <Plus className="size-3.5" />
                          Seçenek ekle
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Önizleme */}
        {Number.isFinite(priceNumber) && draft.name.trim() && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
            <FoodImage
              seed={draft.id ?? "yeni-urun"}
              src={product?.image}
              className="size-12 shrink-0"
              iconClassName="size-4"
              sizes="48px"
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                {draft.name}
                {draft.popular && <Badge tone="accent">Popüler</Badge>}
                {draft.soldOut && <Badge tone="danger">Tükendi</Badge>}
              </p>
              <p className="truncate text-xs text-muted">
                {draft.description || "Açıklama yok"}
              </p>
            </div>
            <span className="tabular shrink-0 font-extrabold text-ink">
              {formatPrice(priceNumber)}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

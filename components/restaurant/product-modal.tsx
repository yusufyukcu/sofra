"use client";

import { AlertCircle, Check } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildLine,
  defaultSelections,
  useCart,
  type CartRestaurantMeta,
} from "@/lib/store/cart";
import type { OptionGroup, Product } from "@/lib/types";
import { cn, formatDelta, formatPrice } from "@/lib/utils";
import { FoodImage } from "@/components/ui/food-image";
import { Modal } from "@/components/ui/modal";
import {
  Badge,
  Button,
  QuantityStepper,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/**
 * Ürün detay / varyant seçimi.
 *
 * Opsiyon ağacı tek bir modelle ifade edilir:
 *   - `single` + required → radio (Boyut, Pişirme derecesi)
 *   - `multi`             → checkbox (Malzemeler, Ekstralar, İstemediklerim)
 *   - `minSelect/maxSelect` ile çoklu seçim sınırlanır
 */
export function ProductModal({
  product,
  restaurant,
  open,
  onClose,
  tone,
}: {
  product: Product | null;
  restaurant: CartRestaurantMeta;
  open: boolean;
  onClose: () => void;
  tone?: string;
}) {
  if (!product) return null;
  return (
    <ProductModalInner
      key={product.id}
      product={product}
      restaurant={restaurant}
      open={open}
      onClose={onClose}
      tone={tone}
    />
  );
}

function ProductModalInner({
  product,
  restaurant,
  open,
  onClose,
  tone,
}: {
  product: Product;
  restaurant: CartRestaurantMeta;
  open: boolean;
  onClose: () => void;
  tone?: string;
}) {
  const toast = useToast();
  const addLine = useCart((s) => s.addLine);
  const replaceWith = useCart((s) => s.replaceWith);
  const currentRestaurant = useCart((s) => s.restaurant);

  const [selections, setSelections] = useState<Record<string, string[]>>(() =>
    defaultSelections(product)
  );
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [conflict, setConflict] = useState(false);

  const line = useMemo(
    () => buildLine(product, selections, quantity, note),
    [product, selections, quantity, note]
  );

  const groupErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    for (const group of product.optionGroups) {
      const picked = selections[group.id] ?? [];
      if (group.required && picked.length === 0) {
        errors[group.id] = "Bu seçim zorunlu.";
      } else if (group.minSelect && picked.length < group.minSelect) {
        errors[group.id] = `En az ${group.minSelect} seçim yapmalısın.`;
      }
    }
    return errors;
  }, [product.optionGroups, selections]);

  const isValid = Object.keys(groupErrors).length === 0;

  function toggle(group: OptionGroup, optionId: string) {
    setSelections((current) => {
      const picked = current[group.id] ?? [];
      if (group.type === "single") {
        return { ...current, [group.id]: [optionId] };
      }
      if (picked.includes(optionId)) {
        return { ...current, [group.id]: picked.filter((id) => id !== optionId) };
      }
      if (group.maxSelect && picked.length >= group.maxSelect) {
        toast.show(
          `"${group.name}" için en fazla ${group.maxSelect} seçim yapabilirsin.`,
          "info"
        );
        return current;
      }
      return { ...current, [group.id]: [...picked, optionId] };
    });
  }

  function submit() {
    if (!isValid) {
      setShowErrors(true);
      return;
    }
    const result = addLine(restaurant, line);
    if (!result.ok) {
      setConflict(true);
      return;
    }
    toast.success(`${product.name} sepete eklendi.`);
    onClose();
  }

  const total = formatPrice(line.unitPrice * quantity);

  return (
    <>
      <Modal
        open={open && !conflict}
        onClose={onClose}
        size="md"
        hideClose={false}
        footer={
          <div className="flex items-center gap-3">
            <QuantityStepper value={quantity} onChange={setQuantity} />
            <Button block size="lg" onClick={submit} disabled={product.soldOut}>
              {product.soldOut ? "Tükendi" : `Sepete ekle · ${total}`}
            </Button>
          </div>
        }
      >
        <FoodImage
          seed={product.id}
          tone={tone}
          src={product.image}
          alt={product.name}
          className="aspect-[16/10] w-full"
          rounded="rounded-2xl"
          iconClassName="size-14"
          sizes="(min-width: 640px) 472px, 100vw"
          eager
        />

        <div className="mt-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-xl font-extrabold leading-tight text-ink">
              {product.name}
            </h2>
            <div className="shrink-0 text-right">
              <span className="tabular block text-lg font-extrabold text-ink">
                {formatPrice(product.price)}
              </span>
              {product.oldPrice && (
                <span className="text-sm text-muted line-through">
                  {formatPrice(product.oldPrice)}
                </span>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {product.description}
          </p>
        </div>

        <div className="mt-6 space-y-6">
          {product.optionGroups.map((group) => {
            const picked = selections[group.id] ?? [];
            const error = showErrors ? groupErrors[group.id] : undefined;
            return (
              <section key={group.id}>
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <h3 className="text-[15px] font-bold text-ink">{group.name}</h3>
                  <span className="shrink-0">
                    {group.required ? (
                      <Badge tone="brand">Zorunlu</Badge>
                    ) : group.maxSelect ? (
                      <Badge>En fazla {group.maxSelect}</Badge>
                    ) : (
                      <Badge>İsteğe bağlı</Badge>
                    )}
                  </span>
                </div>

                {error && (
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-danger">
                    <AlertCircle className="size-3.5" />
                    {error}
                  </p>
                )}

                <div className="space-y-1.5">
                  {group.options.map((option) => {
                    const active = picked.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={option.soldOut}
                        onClick={() => toggle(group, option.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                          active
                            ? "border-brand bg-brand-soft"
                            : "border-border bg-surface hover:bg-surface-2",
                          option.soldOut && "opacity-50"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center border-2 transition-colors",
                            group.type === "single"
                              ? "rounded-full"
                              : "rounded-md",
                            active
                              ? "border-brand bg-brand text-brand-contrast"
                              : "border-border-strong"
                          )}
                        >
                          {active &&
                            (group.type === "single" ? (
                              <span className="size-2 rounded-full bg-current" />
                            ) : (
                              <Check className="size-3.5" strokeWidth={3} />
                            ))}
                        </span>

                        <span className="min-w-0 flex-1 text-[15px] font-medium text-text">
                          {option.name}
                          {option.soldOut && (
                            <span className="ml-2 text-xs text-muted">
                              (tükendi)
                            </span>
                          )}
                        </span>

                        {option.priceDelta !== 0 && (
                          <span
                            className={cn(
                              "shrink-0 text-sm font-bold",
                              option.priceDelta > 0 ? "text-text" : "text-success"
                            )}
                          >
                            {formatDelta(option.priceDelta)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section>
            <h3 className="mb-2 text-[15px] font-bold text-ink">
              Sipariş notu
            </h3>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Örn: Sosu ayrı olsun, soğan koymayın…"
            />
            <p className="mt-1 text-right text-xs text-muted">
              {note.length}/200
            </p>
          </section>
        </div>
      </Modal>

      {/* Farklı restoran uyarısı */}
      <Modal
        open={conflict}
        onClose={() => setConflict(false)}
        title="Sepetini değiştirelim mi?"
        description={`Sepetinde ${currentRestaurant?.name ?? "başka bir restoran"} siparişi var. Farklı bir restorandan ürün eklemek için mevcut sepeti boşaltmamız gerekiyor.`}
        size="sm"
      >
        <div className="mt-2 flex gap-3">
          <Button
            variant="secondary"
            block
            onClick={() => {
              setConflict(false);
            }}
          >
            Vazgeç
          </Button>
          <Button
            block
            onClick={() => {
              replaceWith(restaurant, line);
              setConflict(false);
              toast.success("Sepet yenilendi ve ürün eklendi.");
              onClose();
            }}
          >
            Sepeti boşalt ve ekle
          </Button>
        </div>
      </Modal>
    </>
  );
}

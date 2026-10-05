"use client";

import { NotebookPen, Trash2 } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/store/cart";
import type { CartLine } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";
import { FoodImage } from "@/components/ui/food-image";
import { QuantityStepper, Textarea } from "@/components/ui/primitives";

/** Sepetteki tek bir satır: seçenekler, not, adet ve tutar. */
export function CartLineRow({
  line,
  compact = false,
  editable = true,
}: {
  line: CartLine;
  compact?: boolean;
  editable?: boolean;
}) {
  const updateQuantity = useCart((s) => s.updateQuantity);
  const updateNote = useCart((s) => s.updateNote);
  const removeLine = useCart((s) => s.removeLine);
  const [editingNote, setEditingNote] = useState(false);

  const total = line.unitPrice * line.quantity;

  return (
    <div className={cn("flex gap-3", compact ? "p-3" : "p-4")}>
      {!compact && (
        <FoodImage
          seed={line.productId}
          src={line.image}
          alt={line.name}
          className="size-16 shrink-0"
          iconClassName="size-5"
          sizes="64px"
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={cn(
              "font-bold leading-tight text-text",
              compact ? "text-sm" : "text-[15px]"
            )}
          >
            {compact && (
              <span className="mr-1.5 text-muted">{line.quantity}×</span>
            )}
            {line.name}
          </h4>
          <span
            className={cn(
              "shrink-0 font-extrabold text-text",
              compact ? "text-sm" : "text-[15px]"
            )}
          >
            {formatPrice(total)}
          </span>
        </div>

        {line.selections.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {line.selections.map((selection) => (
              <li key={selection.groupId} className="text-xs text-muted">
                <span className="font-medium">{selection.groupName}:</span>{" "}
                {selection.optionNames.join(", ")}
                {selection.priceDelta !== 0 && (
                  <span className="ml-1 text-muted/80">
                    ({selection.priceDelta > 0 ? "+" : ""}
                    {formatPrice(selection.priceDelta)})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {line.note && !editingNote && (
          <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-surface-2 px-2 py-1.5 text-xs italic text-muted">
            <NotebookPen className="mt-0.5 size-3 shrink-0" />
            {line.note}
          </p>
        )}

        {editingNote && (
          <div className="mt-2">
            <Textarea
              rows={2}
              autoFocus
              defaultValue={line.note ?? ""}
              maxLength={200}
              placeholder="Ürün notu…"
              onBlur={(e) => {
                updateNote(line.lineId, e.target.value);
                setEditingNote(false);
              }}
              className="text-sm"
            />
          </div>
        )}

        {editable && (
          <div className="mt-2.5 flex items-center gap-2">
            <QuantityStepper
              value={line.quantity}
              onChange={(q) => updateQuantity(line.lineId, q)}
              min={1}
              size="sm"
            />
            {!compact && (
              <button
                type="button"
                onClick={() => setEditingNote((v) => !v)}
                className="rounded-lg px-2 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                {line.note ? "Notu düzenle" : "Not ekle"}
              </button>
            )}
            <button
              type="button"
              onClick={() => removeLine(line.lineId)}
              aria-label={`${line.name} ürününü sepetten çıkar`}
              className="ml-auto rounded-lg p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  MAX_LINE_QUANTITY,
  buildLine,
  cartItemCount,
  cartSubtotal,
  createId,
  defaultSelections,
  sameLine,
  toCartMeta,
  type CartLine,
  type CartRestaurantMeta,
} from "@sofra/core";

/**
 * Sepet durumu.
 *
 * Sepet tek restorana aittir (sektör standardı): farklı bir restorandan
 * ürün eklenmek istendiğinde kullanıcıya onay sorulur. Sepet localStorage'da
 * saklanır, böylece sayfa yenilense de kaybolmaz.
 */

interface CartState {
  restaurant: CartRestaurantMeta | null;
  lines: CartLine[];

  addLine: (
    restaurant: CartRestaurantMeta,
    line: Omit<CartLine, "lineId">
  ) => { ok: true } | { ok: false; reason: "different_restaurant" };
  /** Farklı restoran onayı sonrası: sepeti temizleyip ekler. */
  replaceWith: (
    restaurant: CartRestaurantMeta,
    line: Omit<CartLine, "lineId">
  ) => void;
  setLines: (restaurant: CartRestaurantMeta, lines: CartLine[]) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateNote: (lineId: string, note: string) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      restaurant: null,
      lines: [],

      addLine: (restaurant, line) => {
        const state = get();
        if (
          state.restaurant &&
          state.restaurant.id !== restaurant.id &&
          state.lines.length > 0
        ) {
          return { ok: false, reason: "different_restaurant" };
        }

        const existing = state.lines.find((l) => sameLine(line, l));
        if (existing) {
          set({
            restaurant,
            lines: state.lines.map((l) =>
              l.lineId === existing.lineId
                ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, l.quantity + line.quantity) }
                : l
            ),
          });
        } else {
          set({
            restaurant,
            lines: [...state.lines, { ...line, lineId: createId("ln") }],
          });
        }
        return { ok: true };
      },

      replaceWith: (restaurant, line) => {
        set({
          restaurant,
          lines: [{ ...line, lineId: createId("ln") }],
        });
      },

      setLines: (restaurant, lines) => set({ restaurant, lines }),

      updateQuantity: (lineId, quantity) => {
        if (quantity <= 0) {
          get().removeLine(lineId);
          return;
        }
        set({
          lines: get().lines.map((l) =>
            l.lineId === lineId ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, quantity) } : l
          ),
        });
      },

      updateNote: (lineId, note) =>
        set({
          lines: get().lines.map((l) =>
            l.lineId === lineId ? { ...l, note: note.slice(0, 200) } : l
          ),
        }),

      removeLine: (lineId) => {
        const lines = get().lines.filter((l) => l.lineId !== lineId);
        set({ lines, restaurant: lines.length ? get().restaurant : null });
      },

      clear: () => set({ restaurant: null, lines: [] }),
    }),
    {
      name: "sofra:cart",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

/* ------------------------------------------------------------------ */
/* Seçiciler                                                           */
/* ------------------------------------------------------------------ */

export const cartCount = (state: CartState) => cartItemCount(state.lines);
export const cartTotal = (state: CartState) => cartSubtotal(state.lines);

/* Çekirdekten gelen saf yardımcılar — mevcut importlar çalışmaya devam eder. */
export {
  buildLine,
  defaultSelections,
  toCartMeta,
  type CartRestaurantMeta,
} from "@sofra/core";

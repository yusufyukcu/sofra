"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { api } from "../api-client";
import { DEFAULT_CENTER } from "../constants";
import { closeRealtime } from "../realtime";
import type { Address, LatLng, Order, SavedCard, User } from "../types";

/**
 * Oturum ve teslimat konumu durumu.
 *
 * Giriş yapmamış kullanıcı da restoranları konumuna göre görebilsin diye
 * "misafir konumu" ayrıca tutulur; giriş yapıldığında varsayılan adres
 * devralır.
 */

interface SessionState {
  status: "loading" | "authenticated" | "guest";
  user: User | null;
  addresses: Address[];
  cards: SavedCard[];
  activeOrders: Order[];

  /** Seçili teslimat adresi (giriş yapmış kullanıcı) */
  selectedAddressId: string | null;
  /** Giriş yapmamış kullanıcının haritadan seçtiği konum */
  guestPoint: LatLng | null;
  guestLabel: string | null;

  bootstrap: () => Promise<void>;
  applyAuth: (payload: {
    user: User;
    addresses?: Address[];
    cards?: SavedCard[];
  }) => void;
  logout: () => Promise<void>;
  setAddresses: (addresses: Address[]) => void;
  setCards: (cards: SavedCard[]) => void;
  selectAddress: (id: string) => void;
  setGuestLocation: (point: LatLng, label: string) => void;
  setUser: (user: User) => void;
  refreshActiveOrders: () => Promise<void>;
  toggleFavorite: (restaurantId: string) => Promise<boolean>;
}

interface MeResponse {
  user: User;
  addresses: Address[];
  cards: SavedCard[];
  activeOrders: Order[];
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      status: "loading",
      user: null,
      addresses: [],
      cards: [],
      activeOrders: [],
      selectedAddressId: null,
      guestPoint: null,
      guestLabel: null,

      bootstrap: async () => {
        try {
          const data = await api.get<MeResponse>("/auth/me");
          const selected =
            get().selectedAddressId &&
            data.addresses.some((a) => a.id === get().selectedAddressId)
              ? get().selectedAddressId
              : (data.addresses.find((a) => a.isDefault)?.id ??
                data.addresses[0]?.id ??
                null);

          set({
            status: "authenticated",
            user: data.user,
            addresses: data.addresses,
            cards: data.cards,
            activeOrders: data.activeOrders,
            selectedAddressId: selected,
          });
        } catch {
          set({
            status: "guest",
            user: null,
            addresses: [],
            cards: [],
            activeOrders: [],
            selectedAddressId: null,
          });
        }
      },

      applyAuth: ({ user, addresses = [], cards = [] }) => {
        set({
          status: "authenticated",
          user,
          addresses,
          cards,
          selectedAddressId:
            addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null,
        });
      },

      logout: async () => {
        try {
          await api.post("/auth/logout");
        } finally {
          closeRealtime("customer");
          set({
            status: "guest",
            user: null,
            addresses: [],
            cards: [],
            activeOrders: [],
            selectedAddressId: null,
          });
        }
      },

      setCards: (cards) => set({ cards }),

      setAddresses: (addresses) => {
        const current = get().selectedAddressId;
        const stillThere = addresses.some((a) => a.id === current);
        set({
          addresses,
          selectedAddressId: stillThere
            ? current
            : (addresses.find((a) => a.isDefault)?.id ??
              addresses[0]?.id ??
              null),
        });
      },

      selectAddress: (id) => set({ selectedAddressId: id }),

      setGuestLocation: (point, label) =>
        set({ guestPoint: point, guestLabel: label }),

      setUser: (user) => set({ user }),

      refreshActiveOrders: async () => {
        if (get().status !== "authenticated") return;
        try {
          const data = await api.get<MeResponse>("/auth/me");
          set({
            user: data.user,
            activeOrders: data.activeOrders,
            addresses: data.addresses,
          });
        } catch {
          /* sessizce geç */
        }
      },

      toggleFavorite: async (restaurantId) => {
        const data = await api.post<{
          favoriteIds: string[];
          isFavorite: boolean;
        }>("/favorites", { restaurantId });
        const user = get().user;
        if (user) {
          set({ user: { ...user, favoriteRestaurantIds: data.favoriteIds } });
        }
        return data.isFavorite;
      },
    }),
    {
      name: "sofra:session",
      storage: createJSONStorage(() => localStorage),
      // Sunucudan yeniden yüklenebilecek veriyi saklamıyoruz.
      partialize: (state) => ({
        selectedAddressId: state.selectedAddressId,
        guestPoint: state.guestPoint,
        guestLabel: state.guestLabel,
      }),
    }
  )
);

/* ------------------------------------------------------------------ */
/* Türetilmiş seçiciler                                                */
/* ------------------------------------------------------------------ */

export function selectedAddress(state: SessionState): Address | null {
  if (!state.selectedAddressId) return null;
  return state.addresses.find((a) => a.id === state.selectedAddressId) ?? null;
}

/** Restoranları filtrelemek için kullanılacak konum. */
export function deliveryPoint(state: SessionState): LatLng {
  return selectedAddress(state)?.point ?? state.guestPoint ?? DEFAULT_CENTER;
}

/** Başlıkta gösterilecek konum etiketi. */
export function deliveryLabel(state: SessionState): string {
  const address = selectedAddress(state);
  if (address) return `${address.title} · ${address.district}`;
  if (state.guestLabel) return state.guestLabel;
  return "Konum seç";
}

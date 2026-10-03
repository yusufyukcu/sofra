import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_CENTER,
  type Address,
  type LatLng,
  type Order,
  type SavedCard,
  type User,
} from "@sofra/core";
import { api, onUnauthorized } from "@/lib/api";
import { clearToken, saveAuthPayload } from "@/lib/token-store";

/**
 * Oturum ve teslimat konumu.
 *
 * Web'deki `lib/store/session.ts` ile aynı sözleşme: aynı alanlar, aynı
 * eylemler, aynı türetilmiş seçiciler. İki fark var — kalıcı depo
 * `localStorage` yerine `AsyncStorage`, ve girişte dönen erişim/yenileme
 * token çifti cihazın güvenli alanına yazılır.
 *
 * Giriş yapmamış kullanıcı da restoranları konumuna göre görebilsin diye
 * "misafir konumu" ayrıca tutulur.
 */

interface MeResponse {
  user: User;
  addresses: Address[];
  cards: SavedCard[];
  activeOrders: Order[];
}

interface SessionState {
  status: "loading" | "authenticated" | "guest";
  user: User | null;
  addresses: Address[];
  cards: SavedCard[];
  activeOrders: Order[];

  selectedAddressId: string | null;
  guestPoint: LatLng | null;
  guestLabel: string | null;

  /** Sunucuya hiç ulaşamadıysak ayrı gösterilir — "giriş yok" ile aynı şey değil. */
  offline: boolean;

  bootstrap: () => Promise<void>;
  applyAuth: (payload: {
    user: User;
    accessToken?: string;
    refreshToken?: string | null;
    expiresAt?: number | null;
    addresses?: Address[];
    cards?: SavedCard[];
  }) => Promise<void>;
  setCards: (cards: SavedCard[]) => void;
  logout: () => Promise<void>;
  setAddresses: (addresses: Address[]) => void;
  selectAddress: (id: string) => void;
  setGuestLocation: (point: LatLng, label: string) => void;
  setUser: (user: User) => void;
  refresh: () => Promise<void>;
  toggleFavorite: (restaurantId: string) => Promise<boolean>;
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
      offline: false,

      bootstrap: async () => {
        try {
          const data = await api.get<MeResponse>("/auth/me");
          const current = get().selectedAddressId;
          const selected =
            current && data.addresses.some((a) => a.id === current)
              ? current
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
            offline: false,
          });
        } catch (err) {
          const offline =
            err instanceof Error && "code" in err && err.code === "network_error";
          set({
            status: "guest",
            user: null,
            addresses: [],
            cards: [],
            activeOrders: [],
            selectedAddressId: null,
            offline,
          });
        }
      },

      applyAuth: async ({ user, accessToken, refreshToken, expiresAt, addresses = [], cards = [] }) => {
        await saveAuthPayload("customer", { accessToken, refreshToken, expiresAt });
        set({
          status: "authenticated",
          user,
          addresses,
          cards,
          offline: false,
          selectedAddressId:
            addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null,
        });
      },

      logout: async () => {
        try {
          await api.post("/auth/logout");
        } catch {
          /* çevrimdışıyken de yerel oturum kapanmalı */
        } finally {
          await clearToken("customer");
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

      setCards: (cards) => set({ cards }),

      setGuestLocation: (point, label) =>
        set({ guestPoint: point, guestLabel: label }),

      setUser: (user) => set({ user }),

      refresh: async () => {
        if (get().status !== "authenticated") return;
        try {
          const data = await api.get<MeResponse>("/auth/me");
          set({
            user: data.user,
            activeOrders: data.activeOrders,
            addresses: data.addresses,
            cards: data.cards,
            offline: false,
          });
        } catch {
          /* sessizce geç — ekranda eski veri kalsın */
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
      storage: createJSONStorage(() => AsyncStorage),
      // Sunucudan yeniden yüklenebilecek veriyi saklamıyoruz.
      partialize: (state) => ({
        selectedAddressId: state.selectedAddressId,
        guestPoint: state.guestPoint,
        guestLabel: state.guestLabel,
      }),
    }
  )
);

/** Yenileme de reddedildiyse oturumu düşür — API istemcisi bunu tetikler. */
onUnauthorized("customer", () => {
  if (useSession.getState().status === "authenticated") {
    useSession.setState({
      status: "guest",
      user: null,
      addresses: [],
      cards: [],
      activeOrders: [],
    });
  }
});

/* ------------------------------------------------------------------ */
/* Türetilmiş seçiciler — web ile birebir aynı                          */
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

import type { OrderStatus, PaymentMethodId } from "./types";

/**
 * Arayüz ikonları — emoji yerine.
 *
 * İkonlar Lucide setinden gelir; web `lucide-react`, mobil
 * `lucide-react-native` kullanır ve ikisinde de adlar aynıdır. Burada
 * yalnızca hangi kavramın hangi ikonla çizileceği tutulur, böylece iki
 * istemci aynı dili konuşur: "hazırlanıyor" her yerde aşçı şapkası,
 * "kapıda nakit" her yerde banknot.
 *
 * Veri modelindeki `emoji` alanları API uyumu için yerinde duruyor; arayüz
 * onları artık göstermiyor.
 */
export type IconName =
  | "LayoutGrid"
  | "Star"
  | "Hamburger"
  | "Beef"
  | "Pizza"
  | "Drumstick"
  | "Leaf"
  | "CakeSlice"
  | "Salad"
  | "EggFried"
  | "Soup"
  | "Fish"
  | "CookingPot"
  | "Wheat"
  | "Sandwich"
  | "Coffee"
  | "UtensilsCrossed"
  | "ReceiptText"
  | "ChefHat"
  | "Bike"
  | "CircleCheck"
  | "CircleX"
  | "CreditCard"
  | "Wallet"
  | "Ticket"
  | "Nfc"
  | "Banknote"
  | "House"
  | "Building2"
  | "MapPin"
  | "Store";

/** Mutfak etiketi → ikon. Fotoğrafı olmayan ürün ve restoranların yer tutucusunda kullanılır. */
export const CUISINE_ICONS: Record<string, IconName> = {
  all: "LayoutGrid",
  "top-rated": "Star",
  burger: "Hamburger",
  kebap: "Beef",
  pizza: "Pizza",
  tavuk: "Drumstick",
  cigkofte: "Leaf",
  tatli: "CakeSlice",
  saglikli: "Salad",
  kahvalti: "EggFried",
  uzakdogu: "Soup",
  deniz: "Fish",
  evyemekleri: "CookingPot",
  pide: "Wheat",
  tost: "Sandwich",
  kahve: "Coffee",
};

export function cuisineIcon(tag?: string): IconName {
  return (tag && CUISINE_ICONS[tag]) || "UtensilsCrossed";
}

export const ORDER_STATUS_ICONS = {
  pending_approval: "ReceiptText",
  preparing: "ChefHat",
  on_the_way: "Bike",
  delivered: "CircleCheck",
  cancelled: "CircleX",
} as const satisfies Record<OrderStatus, IconName>;

export const PAYMENT_METHOD_ICONS = {
  online_card: "CreditCard",
  wallet: "Wallet",
  meal_card: "Ticket",
  card_on_delivery: "Nfc",
  cash_on_delivery: "Banknote",
} as const satisfies Record<PaymentMethodId, IconName>;

/** Adres etiketi (`ev`, `is`, `diger`) → ikon */
export function addressLabelIcon(label?: string): IconName {
  return label === "ev" ? "House" : label === "is" ? "Building2" : "MapPin";
}

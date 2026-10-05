import {
  Banknote,
  Beef,
  Bike,
  Building2,
  CakeSlice,
  ChefHat,
  CircleCheck,
  CircleX,
  Coffee,
  CookingPot,
  CreditCard,
  Drumstick,
  EggFried,
  Fish,
  Hamburger,
  House,
  LayoutGrid,
  Leaf,
  MapPin,
  Nfc,
  Pizza,
  ReceiptText,
  Salad,
  Sandwich,
  Soup,
  Star,
  Store,
  Ticket,
  UtensilsCrossed,
  Wallet,
  Wheat,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import type { IconName } from "@sofra/core";

/**
 * `@sofra/core`'daki ikon adlarını Lucide bileşenlerine çevirir. Eşleme
 * açıkça yazılı; böylece paket ağacından yalnızca kullanılan ikonlar gelir.
 */
const ICONS: Record<IconName, LucideIcon> = {
  LayoutGrid,
  Star,
  Hamburger,
  Beef,
  Pizza,
  Drumstick,
  Leaf,
  CakeSlice,
  Salad,
  EggFried,
  Soup,
  Fish,
  CookingPot,
  Wheat,
  Sandwich,
  Coffee,
  UtensilsCrossed,
  ReceiptText,
  ChefHat,
  Bike,
  CircleCheck,
  CircleX,
  CreditCard,
  Wallet,
  Ticket,
  Nfc,
  Banknote,
  House,
  Building2,
  MapPin,
  Store,
};

export function Icon({ name, ...props }: { name: IconName } & LucideProps) {
  const Component = ICONS[name];
  return <Component aria-hidden {...props} />;
}

import type { Metadata } from "next";
import { VendorGate } from "@/components/vendor/vendor-gate";

export const metadata: Metadata = {
  title: {
    default: "Restoran Paneli",
    template: "%s · Sofra Isletme",
  },
  description: "Siparisleri yonet, menuyu guncelle, ciroyu takip et.",
};

export default function VendorLayout({ children }: LayoutProps<"/isletme">) {
  return <VendorGate>{children}</VendorGate>;
}

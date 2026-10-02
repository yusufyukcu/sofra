import type { Metadata } from "next";
import { MenuManager } from "@/components/vendor/menu-manager";

export const metadata: Metadata = { title: "Menu & Stok" };

export default function VendorMenuPage() {
  return <MenuManager />;
}

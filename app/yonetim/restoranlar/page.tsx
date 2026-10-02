import type { Metadata } from "next";
import { RestaurantsPanel } from "@/components/admin/restaurants-panel";

export const metadata: Metadata = { title: "Restoranlar" };

export default function AdminRestaurantsPage() {
  return <RestaurantsPanel />;
}

import type { Metadata } from "next";
import { OrderBoard } from "@/components/vendor/order-board";

export const metadata: Metadata = { title: "Siparisler" };

export default function VendorOrdersPage() {
  return <OrderBoard />;
}

import type { Metadata } from "next";
import { OrderHistory } from "@/components/vendor/order-history";

export const metadata: Metadata = { title: "Sipariş geçmişi" };

export default function VendorHistoryPage() {
  return <OrderHistory />;
}

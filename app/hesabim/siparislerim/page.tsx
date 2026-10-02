import type { Metadata } from "next";
import { OrdersList } from "@/components/account/orders-list";

export const metadata: Metadata = { title: "Siparişlerim" };

export default function OrdersPage() {
  return <OrdersList />;
}

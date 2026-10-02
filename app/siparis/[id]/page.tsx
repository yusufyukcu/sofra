import type { Metadata } from "next";
import { OrderTracking } from "@/components/order/order-tracking";

export const metadata: Metadata = {
  title: "Sipariş takibi",
  description: "Siparişinin durumunu ve kuryeni canlı olarak takip et.",
};

export default async function OrderPage(props: PageProps<"/siparis/[id]">) {
  const { id } = await props.params;
  return <OrderTracking orderId={id} />;
}

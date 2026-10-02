import type { Metadata } from "next";
import { CheckoutClient } from "@/components/checkout/checkout-client";

export const metadata: Metadata = {
  title: "Ödeme",
  description: "Teslimat adresini, ödeme yöntemini seç ve siparişini tamamla.",
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}

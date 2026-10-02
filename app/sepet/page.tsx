import type { Metadata } from "next";
import { CartClient } from "@/components/cart/cart-client";

export const metadata: Metadata = {
  title: "Sepetim",
  description: "Sepetindeki ürünleri gözden geçir ve siparişini tamamla.",
};

export default function CartPage() {
  return <CartClient />;
}

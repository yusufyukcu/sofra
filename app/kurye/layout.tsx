import type { Metadata } from "next";
import { CourierGate } from "@/components/courier/courier-gate";

export const metadata: Metadata = {
  title: { default: "Kurye", template: "%s · Sofra Kurye" },
  description: "Vardiyani yonet, siparisleri teslim et, kazancini takip et.",
};

export default function CourierLayout({ children }: LayoutProps<"/kurye">) {
  return <CourierGate>{children}</CourierGate>;
}

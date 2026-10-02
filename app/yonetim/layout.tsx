import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/admin-gate";

export const metadata: Metadata = {
  title: { default: "Yonetim", template: "%s · Sofra Yonetim" },
  description: "Platform operasyonu, finansi ve pazarlamasi tek panelde.",
};

export default function AdminLayout({ children }: LayoutProps<"/yonetim">) {
  return <AdminGate>{children}</AdminGate>;
}

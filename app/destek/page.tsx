import type { Metadata } from "next";
import { SupportPageClient } from "@/components/support/support-page-client";

export const metadata: Metadata = {
  title: "Canlı destek",
  description:
    "Siparişin nerede? İptal, iade ve eksik ürün konularında anında yardım al.",
};

export default function SupportPage() {
  return <SupportPageClient />;
}

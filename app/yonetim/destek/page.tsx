import type { Metadata } from "next";
import { SupportConsole } from "@/components/admin/support-console";

export const metadata: Metadata = { title: "Canlı destek" };

export default function AdminSupportPage() {
  return <SupportConsole />;
}

import type { Metadata } from "next";
import { AdminFinancePanel } from "@/components/admin/admin-finance-panel";

export const metadata: Metadata = { title: "Finans" };

export default function AdminFinancePage() {
  return <AdminFinancePanel />;
}

import type { Metadata } from "next";
import { FinancePanel } from "@/components/vendor/finance-panel";

export const metadata: Metadata = { title: "Finans" };

export default function VendorFinancePage() {
  return <FinancePanel />;
}

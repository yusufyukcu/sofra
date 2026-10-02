import type { Metadata } from "next";
import { MarketingPanel } from "@/components/admin/marketing-panel";

export const metadata: Metadata = { title: "Pazarlama" };

export default function AdminMarketingPage() {
  return <MarketingPanel />;
}

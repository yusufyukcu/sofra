import type { Metadata } from "next";
import { EarningsPanel } from "@/components/courier/earnings-panel";

export const metadata: Metadata = { title: "Kazanc" };

export default function CourierEarningsPage() {
  return <EarningsPanel />;
}

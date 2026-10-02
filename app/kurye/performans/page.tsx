import type { Metadata } from "next";
import { PerformancePanel } from "@/components/courier/performance-panel";

export const metadata: Metadata = { title: "Performans" };

export default function CourierPerformancePage() {
  return <PerformancePanel />;
}

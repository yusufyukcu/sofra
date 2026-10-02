import type { Metadata } from "next";
import { LiveOperations } from "@/components/admin/live-operations";

export const metadata: Metadata = { title: "Canli operasyon" };

export default function AdminHomePage() {
  return <LiveOperations />;
}

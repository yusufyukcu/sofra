import type { Metadata } from "next";
import { NotificationsPanel } from "@/components/account/notifications-panel";

export const metadata: Metadata = { title: "Bildirimler" };

export default function NotificationsPage() {
  return <NotificationsPanel />;
}

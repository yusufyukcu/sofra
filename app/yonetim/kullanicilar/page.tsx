import type { Metadata } from "next";
import { AccountsPanel } from "@/components/admin/accounts-panel";

export const metadata: Metadata = { title: "Kullanicilar" };

export default function AdminAccountsPage() {
  return <AccountsPanel />;
}

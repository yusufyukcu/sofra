import type { Metadata } from "next";
import { WalletPanel } from "@/components/account/wallet-panel";

export const metadata: Metadata = { title: "Cüzdanım" };

export default function WalletPage() {
  return <WalletPanel />;
}

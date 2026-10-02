import type { Metadata } from "next";
import { ProfilePanel } from "@/components/account/profile-panel";

export const metadata: Metadata = { title: "Profilim" };

export default function ProfilePage() {
  return <ProfilePanel />;
}

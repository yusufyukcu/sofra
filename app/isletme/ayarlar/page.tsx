import type { Metadata } from "next";
import { StoreSettings } from "@/components/vendor/store-settings";

export const metadata: Metadata = { title: "Magaza ayarlari" };

export default function VendorSettingsPage() {
  return <StoreSettings />;
}

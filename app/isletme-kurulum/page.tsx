import type { Metadata } from "next";
import { VendorSetup } from "@/components/vendor/vendor-setup";

export const metadata: Metadata = { title: "İşletme paneli kurulumu", robots: { index: false } };

export default async function VendorSetupPage(props: PageProps<"/isletme-kurulum">) {
  const params = await props.searchParams;
  const raw = params.anahtar;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return <VendorSetup token={token} />;
}

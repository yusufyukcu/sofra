import type { Metadata } from "next";
import { VendorLogin } from "@/components/vendor/vendor-login";

export const metadata: Metadata = { title: "Isletme girisi" };

export default function VendorLoginPage() {
  return <VendorLogin />;
}

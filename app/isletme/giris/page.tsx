import type { Metadata } from "next";
import { VendorLogin } from "@/components/vendor/vendor-login";

export const metadata: Metadata = { title: "İşletme girişi" };

export default function VendorLoginPage() {
  // Demo parolası yalnızca geliştirme ortamında ekrana gelir; canlıda asla
  const demoPassword =
    process.env.NODE_ENV !== "production" ? process.env.SOFRA_DEMO_PASSWORD : undefined;
  return <VendorLogin demoPassword={demoPassword} />;
}

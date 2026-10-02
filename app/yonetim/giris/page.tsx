import type { Metadata } from "next";
import { AdminLogin } from "@/components/admin/admin-login";

export const metadata: Metadata = { title: "Yönetici girişi" };

export default function AdminLoginPage() {
  // Demo hesabı yalnızca geliştirme ortamında ekrana gelir; canlıda asla
  const password = process.env.SOFRA_DEMO_PASSWORD;
  const demo =
    process.env.NODE_ENV !== "production" && password
      ? { email: "yonetim@sofra.app", password }
      : undefined;
  return <AdminLogin demo={demo} />;
}

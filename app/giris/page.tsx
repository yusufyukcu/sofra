import type { Metadata } from "next";
import { LoginClient } from "@/components/auth/login-client";

export const metadata: Metadata = {
  title: "Giriş yap",
  description: "Telefon, e-posta veya sosyal hesabınla Sofra'ya giriş yap.",
};

export default async function LoginPage(props: PageProps<"/giris">) {
  const searchParams = await props.searchParams;
  const raw = searchParams.devam;
  const next = (Array.isArray(raw) ? raw[0] : raw) ?? "/";

  // Açık yönlendirme (open redirect) koruması: yalnızca site içi yollar.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return <LoginClient next={safeNext} />;
}

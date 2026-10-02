import type { Metadata } from "next";
import { CourierLogin } from "@/components/courier/courier-login";

export const metadata: Metadata = { title: "Kurye girisi" };

export default function CourierLoginPage() {
  return <CourierLogin />;
}

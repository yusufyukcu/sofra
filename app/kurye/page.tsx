import type { Metadata } from "next";
import { CourierOperations } from "@/components/courier/courier-operations";

export const metadata: Metadata = { title: "Teslimat" };

export default function CourierHomePage() {
  return <CourierOperations />;
}

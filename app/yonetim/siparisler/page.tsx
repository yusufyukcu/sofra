import type { Metadata } from "next";
import { OrderSearch } from "@/components/admin/order-search";

export const metadata: Metadata = { title: "Siparişler & iade" };

export default async function AdminOrdersPage({ searchParams }: PageProps<"/yonetim/siparisler">) {
  const { q } = await searchParams;
  return <OrderSearch initialQuery={typeof q === "string" ? q : ""} />;
}

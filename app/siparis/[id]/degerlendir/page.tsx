import type { Metadata } from "next";
import { RatingForm } from "@/components/order/rating-form";

export const metadata: Metadata = {
  title: "Siparişi değerlendir",
  description: "Restoranı ve kuryeni ayrı ayrı puanla.",
};

export default async function RatingPage(
  props: PageProps<"/siparis/[id]/degerlendir">
) {
  const { id } = await props.params;
  return <RatingForm orderId={id} />;
}

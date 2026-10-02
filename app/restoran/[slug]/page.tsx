import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { customerMenu, findRestaurant, findRestaurantRow, reviewsOf } from "@/lib/db/queries";
import { RestaurantClient } from "@/components/restaurant/restaurant-client";

/*
 * Menüler Restoran Panelinden anlık değiştirilebildiği için bu sayfa
 * statik üretilmez; her istek güncel menüyü okur.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/restoran/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const restaurant = await findRestaurantRow(slug);
  // Onaysız restoranın adı başlıkta da görünmesin
  if (!restaurant || restaurant.approvalStatus !== "approved") {
    return { title: "Restoran bulunamadı" };
  }

  return {
    title: restaurant.name,
    description: restaurant.description,
    openGraph: {
      title: `${restaurant.name} · Sofra`,
      description: restaurant.description,
    },
  };
}

export default async function RestaurantPage(props: PageProps<"/restoran/[slug]">) {
  const { slug } = await props.params;
  const restaurant = await findRestaurant(slug);
  // Onay bekleyen veya askıya alınan restoranlar müşteriye görünmez
  if (!restaurant || restaurant.approvalStatus !== "approved") notFound();

  return (
    <RestaurantClient
      restaurant={customerMenu(restaurant)}
      reviews={await reviewsOf(restaurant.id, 24)}
    />
  );
}

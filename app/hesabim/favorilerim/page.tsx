import type { Metadata } from "next";
import { FavoritesList } from "@/components/account/favorites-list";

export const metadata: Metadata = { title: "Favorilerim" };

export default function FavoritesPage() {
  return <FavoritesList />;
}

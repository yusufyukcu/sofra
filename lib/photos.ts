import { CATEGORIES } from "./constants";

/**
 * Restoranın kapak fotoğrafı. Panelden yeni katılan restoranların henüz
 * fotoğrafı yoktur; onlar için ilk mutfağının fotoğrafı kullanılır ki
 * listede gerçek fotoğrafların arasında çizim kalmasın.
 */
export function restaurantPhoto(restaurant: {
  image?: string;
  tags: string[];
}): string | undefined {
  return (
    restaurant.image ??
    CATEGORIES.find((c) => c.id === restaurant.tags[0])?.image
  );
}

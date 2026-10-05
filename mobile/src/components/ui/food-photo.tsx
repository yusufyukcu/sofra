import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { API_BASE_URL } from "@/lib/api";
import { FoodArt } from "./food-art";

/**
 * Yemek fotoğrafı — web'deki `FoodImage`'ın karşılığı.
 *
 * Fotoğraflar web sunucusundan gelir (`/images/food/…`); yol köke göreliyse
 * API adresinin önüne eklenir. Yüklenirken mutfağa göre renklenen degrade
 * görünür, fotoğraf yoksa ya da açılamazsa degradenin ortasında mutfağın
 * ikonu kalır — listede hiçbir zaman kırık görsel olmaz. `expo-image`
 * fotoğrafı bellekte ve diskte saklar; aynı tabak ikinci kez inmez.
 */
export function photoUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function FoodPhoto({
  src,
  seed,
  tone,
  style,
  radius = 14,
  iconSize = 34,
  priority,
}: {
  src?: string;
  seed: string;
  tone?: string;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  iconSize?: number;
  /** İlk ekranın büyük görseli: önce bu insin */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(src) && !failed;

  return (
    <View style={[styles.wrap, { borderRadius: radius }, style]}>
      <FoodArt
        seed={seed}
        tone={tone}
        radius={0}
        iconSize={iconSize}
        showIcon={!showPhoto}
        style={StyleSheet.absoluteFill}
      />
      {showPhoto ? (
        <Image
          source={{ uri: photoUrl(src!) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={220}
          cachePolicy="memory-disk"
          priority={priority ? "high" : "normal"}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },
});

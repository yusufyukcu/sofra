import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { cuisineIcon, foodArtwork } from "@sofra/core";
import { Icon } from "./icon";

/**
 * Ürün/restoran görseli.
 *
 * Renkler ve geometri `@sofra/core`'daki `foodArtwork` ile üretilir — web
 * bunu CSS `radial-gradient` katmanlarıyla çizer, burada aynı katmanlar
 * `react-native-svg` ile kuruluyor. Aynı tohum iki istemcide aynı görseli
 * verir; kebapçı sıcak kırmızı, sağlıklı mutfak yeşil, balıkçı mavi olur.
 *
 * Ağ bağlantısı gerektirmez, kırık görsel oluşmaz. Ortada mutfağın ikonu
 * durur (emoji değil). Gerçek fotoğraf varsa `FoodPhoto` bunu yalnızca
 * yükleme sırasında ve fotoğraf açılamazsa gösterir.
 */

export function FoodArt({
  seed,
  tone,
  style,
  radius = 14,
  iconSize = 34,
  showIcon = true,
}: {
  seed: string;
  /** Mutfak etiketi; renk ve ikon buna göre seçilir */
  tone?: string;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  iconSize?: number;
  /** Fotoğraf yüklenirken arkada sade degrade yeterli */
  showIcon?: boolean;
}) {
  const art = foodArtwork(seed, tone);
  const [b1, b2, b3] = art.blobs;
  const [base1, base2] = art.base;
  const id = `fa-${seed.replace(/[^a-z0-9]/gi, "")}`;

  // CSS `linear-gradient(Xdeg, ...)` ile aynı yönü SVG'de kurmak için açıyı
  // birim vektöre çeviriyoruz. CSS 0° = yukarı, saat yönünde artar.
  const rad = ((art.angle - 90) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);

  return (
    <View
      accessibilityRole="image"
      style={[styles.wrap, { borderRadius: radius }, style]}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient
            id={`${id}-base`}
            x1={`${50 - dx * 50}%`}
            y1={`${50 - dy * 50}%`}
            x2={`${50 + dx * 50}%`}
            y2={`${50 + dy * 50}%`}
          >
            <Stop offset="0" stopColor={base1} />
            <Stop offset="1" stopColor={base2} />
          </LinearGradient>

          {/* Üç leke — web'deki üç radial-gradient katmanı */}
          <RadialGradient
            id={`${id}-b1`}
            cx={`${art.centers[0][0]}%`}
            cy={`${art.centers[0][1]}%`}
            rx="58%"
            ry="68%"
          >
            <Stop offset="0" stopColor={b1} stopOpacity="1" />
            <Stop offset="0.68" stopColor={b1} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id={`${id}-b2`}
            cx={`${art.centers[1][0]}%`}
            cy={`${art.centers[1][1]}%`}
            rx="52%"
            ry="62%"
          >
            <Stop offset="0" stopColor={b2} stopOpacity="1" />
            <Stop offset="0.66" stopColor={b2} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id={`${id}-b3`}
            cx={`${art.centers[2][0]}%`}
            cy={`${art.centers[2][1]}%`}
            rx="74%"
            ry="82%"
          >
            <Stop offset="0" stopColor={b3} stopOpacity="1" />
            <Stop offset="0.72" stopColor={b3} stopOpacity="0" />
          </RadialGradient>

          {/* Üstten gelen yumuşak ışık — üzerine yazılan metin okunur kalsın */}
          <LinearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
            <Stop offset="0.42" stopColor="#ffffff" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.28" />
          </LinearGradient>
        </Defs>

        <Rect width="100%" height="100%" fill={`url(#${id}-base)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}-b1)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}-b2)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}-b3)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}-sheen)`} />
      </Svg>

      {showIcon ? (
        <View
          style={[
            styles.badge,
            { padding: iconSize * 0.36, borderRadius: iconSize },
          ]}
        >
          <Icon name={cuisineIcon(tone)} size={iconSize} color="#ffffff" strokeWidth={1.7} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
});

import { View, type StyleProp, type ViewStyle } from "react-native";
import { avatarFor } from "@sofra/core";
import { Text } from "./text";

/**
 * Baş harfli avatar — emoji yerine. Renk isimden türer; web'deki `Avatar`
 * ile aynı kural, aynı kişi iki istemcide de aynı rengi alır.
 */
export function Avatar({
  name,
  size = 40,
  style,
}: {
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { initials, color } = avatarFor(name);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        weight="bold"
        style={{ color: "#ffffff", fontSize: size * 0.38, lineHeight: size * 0.46, letterSpacing: -0.3 }}
      >
        {initials}
      </Text>
    </View>
  );
}

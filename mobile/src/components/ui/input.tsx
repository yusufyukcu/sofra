import { useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme";
import { Text } from "./text";

/**
 * Metin alanı, seçim listesi ve sayaç.
 *
 * Odaklanınca çerçeve marka rengine döner — web'deki `--ring` jetonunun
 * karşılığı. Hata mesajı alanın altında, alan da kırmızı çerçeveyle.
 */

export interface FieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Solda duran sabit ön ek — ör. telefon için "+90" */
  prefix?: string;
  right?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Field({
  label,
  hint,
  error,
  prefix,
  right,
  containerStyle,
  style,
  ...rest
}: FieldProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? t.colors.danger
    : focused
      ? t.colors.brand
      : t.colors.border;

  return (
    <View style={[{ gap: t.spacing.xs }, containerStyle]}>
      {label ? (
        <Text variant="small" weight="semibold" tone="ink">
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.shell,
          {
            backgroundColor: t.colors.surface,
            borderColor,
            borderRadius: t.radius.md,
            borderWidth: focused || error ? 1.6 : StyleSheet.hairlineWidth * 2,
            paddingHorizontal: t.spacing.md,
          },
        ]}
      >
        {prefix ? (
          <Text variant="body" tone="muted" tabular>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={t.colors.muted}
          style={[
            styles.input,
            {
              color: t.colors.text,
              fontFamily: t.fontFamily.regular,
              fontSize: t.fontSize.body,
            },
            rest.multiline && styles.multiline,
            style,
          ]}
        />
        {right}
      </View>

      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Seçim listesi — radyo davranışı                                     */
/* ------------------------------------------------------------------ */

export function Option({
  title,
  subtitle,
  selected,
  onPress,
  disabled,
  left,
  trailing,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  left?: ReactNode;
  trailing?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? t.colors.brandSoft : t.colors.surface,
          borderColor: selected ? t.colors.brand : t.colors.border,
          borderRadius: t.radius.md,
          borderWidth: selected ? 1.6 : StyleSheet.hairlineWidth * 2,
          padding: t.spacing.md,
          opacity: disabled ? 0.45 : pressed ? 0.9 : 1,
        },
      ]}
    >
      {left}
      <View style={styles.optionBody}>
        <Text variant="body" weight="semibold" tone="ink">
          {title}
        </Text>
        {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
      </View>
      {trailing ? (
        <Text variant="small" weight="semibold" tone="ink" tabular>
          {trailing}
        </Text>
      ) : null}
      <View
        style={[
          styles.radio,
          {
            borderColor: selected ? t.colors.brand : t.colors.borderStrong,
            backgroundColor: selected ? t.colors.brand : "transparent",
          },
        ]}
      >
        {selected ? (
          <View
            style={[styles.radioDot, { backgroundColor: t.colors.brandContrast }]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Sayaç                                                               */
/* ------------------------------------------------------------------ */

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 30,
  compact,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
}) {
  const t = useTheme();
  const size = compact ? 30 : 38;

  const step = (delta: number) => {
    const next = value + delta;
    if (next < min || next > max) return;
    onChange(next);
  };

  return (
    <View
      style={[
        styles.stepper,
        {
          backgroundColor: t.colors.surface2,
          borderRadius: t.radius.pill,
          padding: 3,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Azalt"
        onPress={() => step(-1)}
        disabled={value <= min}
        style={({ pressed }) => [
          styles.stepBtn,
          {
            width: size,
            height: size,
            borderRadius: t.radius.pill,
            backgroundColor: t.colors.surface,
            opacity: value <= min ? 0.4 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text variant="bodyLarge" weight="semibold" tone="ink">
          −
        </Text>
      </Pressable>

      <Text
        variant="body"
        weight="semibold"
        tone="ink"
        tabular
        style={{ minWidth: 26, textAlign: "center" }}
      >
        {value}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Artır"
        onPress={() => step(1)}
        disabled={value >= max}
        style={({ pressed }) => [
          styles.stepBtn,
          {
            width: size,
            height: size,
            borderRadius: t.radius.pill,
            backgroundColor: t.colors.surface,
            opacity: value >= max ? 0.4 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text variant="bodyLarge" weight="semibold" tone="ink">
          +
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
  },
  input: { flex: 1, paddingVertical: 12 },
  multiline: { minHeight: 84, textAlignVertical: "top" },
  option: { flexDirection: "row", alignItems: "center", gap: 12 },
  optionBody: { flex: 1, gap: 1 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 7, height: 7, borderRadius: 4 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 2 },
  stepBtn: { alignItems: "center", justifyContent: "center" },
});

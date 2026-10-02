import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildLine,
  defaultSelections,
  formatPrice,
  type OptionGroup,
  type Product,
} from "@sofra/core";
import { Button } from "@/components/ui/button";
import { FoodArt } from "@/components/ui/food-art";
import { Field, Stepper } from "@/components/ui/input";
import { Badge, Divider } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

/**
 * Ürün seçim sayfası.
 *
 * Alttan açılan yaprak: varyant grupları, adet ve not. Hangi seçeneğin
 * zorunlu olduğu, kaç tane seçilebileceği ve fiyat farkının nasıl hesaplandığı
 * `@sofra/core/cart` içinde — web'deki ürün penceresiyle birebir aynı kural.
 *
 * Buradaki fiyat önizlemedir; sipariş verilirken sunucu her şeyi menüden
 * yeniden hesaplar.
 */

/**
 * Çağıran taraf bunu `key={product.id}` ile sarar; ürün değiştiğinde bileşen
 * baştan kurulur ve seçimler varsayılanlarına döner. Durumu efektle
 * sıfırlamaktan daha güvenli: bir kare bile eski seçimle render edilmez.
 */
export function ProductSheet({
  product,
  visible,
  onClose,
  onAdd,
}: {
  product: Product;
  visible: boolean;
  onClose: () => void;
  onAdd: (line: ReturnType<typeof buildLine>) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const [selections, setSelections] = useState<Record<string, string[]>>(() =>
    defaultSelections(product)
  );
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const line = buildLine(product, selections, quantity, note);
  const total = line.unitPrice * quantity;

  /** Zorunlu gruplardan seçim yapılmamış olanlar. */
  const missing = product.optionGroups.filter(
    (g) => g.required && (selections[g.id]?.length ?? 0) === 0
  );
  const canAdd = missing.length === 0;

  function toggle(group: OptionGroup, optionId: string) {
    setTouched(true);
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      if (group.type === "single") {
        return { ...prev, [group.id]: [optionId] };
      }
      const exists = current.includes(optionId);
      if (exists) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      const max = group.maxSelect ?? group.options.length;
      if (current.length >= max) return prev;
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: t.colors.paper,
              borderTopLeftRadius: t.radius.xl,
              borderTopRightRadius: t.radius.xl,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: t.colors.borderStrong }]} />

          <ScrollView
            contentContainerStyle={{ paddingBottom: t.spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            <FoodArt
              seed={product.id}
              emoji={product.emoji}
              radius={0}
              emojiSize={58}
              style={{ height: 150, width: "100%" }}
            />

            <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
              <View style={{ gap: 4 }}>
                <View style={styles.titleRow}>
                  <Text variant="title" style={{ flex: 1 }}>
                    {product.name}
                  </Text>
                  {product.popular ? (
                    <Badge label="Çok satan" tone="saffron" />
                  ) : null}
                </View>
                {product.description ? (
                  <Text variant="small">{product.description}</Text>
                ) : null}
                <View style={styles.priceRow}>
                  <Text variant="bodyLarge" weight="semibold" tone="ink" tabular>
                    {formatPrice(product.price)}
                  </Text>
                  {product.oldPrice ? (
                    <Text
                      variant="small"
                      tabular
                      style={styles.oldPrice}
                    >
                      {formatPrice(product.oldPrice)}
                    </Text>
                  ) : null}
                </View>
              </View>

              {product.optionGroups.map((group) => {
                const chosen = selections[group.id] ?? [];
                const invalid =
                  touched && group.required && chosen.length === 0;

                return (
                  <View key={group.id} style={{ gap: t.spacing.sm }}>
                    <Divider />
                    <View style={styles.groupHead}>
                      <Text variant="body" weight="semibold" tone="ink">
                        {group.name}
                      </Text>
                      <Badge
                        label={
                          group.required
                            ? "Zorunlu"
                            : group.type === "multi"
                              ? `En fazla ${group.maxSelect ?? group.options.length}`
                              : "İsteğe bağlı"
                        }
                        tone={invalid ? "danger" : group.required ? "brand" : "neutral"}
                      />
                    </View>

                    {group.options.map((option) => {
                      const selected = chosen.includes(option.id);
                      return (
                        <Pressable
                          key={option.id}
                          accessibilityRole={
                            group.type === "single" ? "radio" : "checkbox"
                          }
                          accessibilityState={{
                            selected,
                            disabled: option.soldOut,
                          }}
                          onPress={
                            option.soldOut
                              ? undefined
                              : () => toggle(group, option.id)
                          }
                          style={({ pressed }) => [
                            styles.option,
                            {
                              borderColor: selected
                                ? t.colors.brand
                                : t.colors.border,
                              backgroundColor: selected
                                ? t.colors.brandSoft
                                : t.colors.surface,
                              borderRadius: t.radius.md,
                              borderWidth: selected ? 1.6 : StyleSheet.hairlineWidth * 2,
                              opacity: option.soldOut ? 0.45 : pressed ? 0.9 : 1,
                            },
                          ]}
                        >
                          <View
                            style={[
                              group.type === "single"
                                ? styles.radio
                                : styles.checkbox,
                              {
                                borderColor: selected
                                  ? t.colors.brand
                                  : t.colors.borderStrong,
                                backgroundColor: selected
                                  ? t.colors.brand
                                  : "transparent",
                              },
                            ]}
                          >
                            {selected ? (
                              <View
                                style={[
                                  group.type === "single"
                                    ? styles.radioDot
                                    : styles.checkMark,
                                  { backgroundColor: t.colors.brandContrast },
                                ]}
                              />
                            ) : null}
                          </View>

                          <Text
                            variant="body"
                            style={{ flex: 1 }}
                            tone={option.soldOut ? "muted" : "text"}
                          >
                            {option.name}
                            {option.soldOut ? " · tükendi" : ""}
                          </Text>

                          {option.priceDelta !== 0 ? (
                            <Text variant="small" weight="semibold" tabular tone="ink">
                              {option.priceDelta > 0 ? "+" : ""}
                              {formatPrice(option.priceDelta)}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}

              <Divider />
              <Field
                label="Sipariş notu"
                placeholder="Ör. soğan olmasın"
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={200}
              />
            </View>
          </ScrollView>

          {/* Sabit alt çubuk */}
          <View
            style={[
              styles.footer,
              {
                backgroundColor: t.colors.surface,
                borderTopColor: t.colors.border,
                paddingBottom: Math.max(insets.bottom, t.spacing.md),
              },
            ]}
          >
            <Stepper value={quantity} onChange={setQuantity} />
            <Button
              label={canAdd ? "Sepete ekle" : "Zorunlu seçim var"}
              trailing={canAdd ? formatPrice(total) : undefined}
              disabled={!canAdd}
              onPress={() => {
                if (!canAdd) {
                  setTouched(true);
                  return;
                }
                onAdd(line);
              }}
              size="lg"
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(28,18,20,0.5)",
  },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: { maxHeight: "92%", overflow: "hidden" },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginVertical: 8,
    zIndex: 2,
  },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  oldPrice: { textDecorationLine: "line-through" },
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  option: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 7, height: 7, borderRadius: 4 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: { width: 9, height: 9, borderRadius: 2 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

import * as Location from "expo-location";
import { router } from "expo-router";
import { Crosshair } from "lucide-react-native";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { ADDRESS_LABELS, DEFAULT_CENTER, type Address, type AddressLabel, type LatLng } from "@sofra/core";
import { MapView } from "@/components/map/map-view";
import { Button } from "@/components/ui/button";
import { Field, Option } from "@/components/ui/input";
import { Header, SectionTitle, Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/store/session";
import { useTheme } from "@/theme";

/**
 * Adres ekleme.
 *
 * Konum cihazın GPS'inden alınır (izin verilirse) ve sokak/ilçe alanları
 * cihazın ters coğrafi kodlamasıyla önerilir; kullanıcı düzeltebilir.
 * Teslimat bölgesi kontrolü siparişte bu konuma göre yapılır.
 */
export default function AddAddressScreen() {
  const t = useTheme();
  const setAddresses = useSession((s) => s.setAddresses);
  const selectAddress = useSession((s) => s.selectAddress);

  const [point, setPoint] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [label, setLabel] = useState<AddressLabel>("ev");
  const [title, setTitle] = useState("Evim");
  const [line1, setLine1] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("İstanbul");
  const [buildingNo, setBuildingNo] = useState("");
  const [floor, setFloor] = useState("");
  const [apartmentNo, setApartmentNo] = useState("");
  const [directions, setDirections] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function locate() {
    setLocating(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError("Konum izni verilmedi; konumu varsayılan merkezden başlattık.");
        setPoint((current) => current ?? DEFAULT_CENTER);
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const next = { lat: position.coords.latitude, lng: position.coords.longitude };
      setPoint(next);
      const [place] = await Location.reverseGeocodeAsync({ latitude: next.lat, longitude: next.lng }).catch(() => []);
      if (place) {
        const street = [place.street, place.streetNumber].filter(Boolean).join(" ");
        if (street && !line1) setLine1(street);
        if (place.district || place.subregion) setDistrict(place.district ?? place.subregion ?? "");
        if (place.city || place.region) setCity(place.city ?? place.region ?? "İstanbul");
        if (place.streetNumber && !buildingNo) setBuildingNo(place.streetNumber);
      }
    } catch {
      setError("Konum alınamadı; konumu varsayılan merkezden başlattık.");
      setPoint((current) => current ?? DEFAULT_CENTER);
    } finally {
      setLocating(false);
    }
  }

  useEffect(() => {
    void locate();
    // Yalnızca açılışta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!point) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api.post<{ address: Address; addresses: Address[] }>("/addresses", {
        label,
        title: title.trim(),
        line1: line1.trim(),
        district: district.trim(),
        city: city.trim(),
        point,
        buildingNo: buildingNo.trim() || undefined,
        floor: floor.trim() || undefined,
        apartmentNo: apartmentNo.trim() || undefined,
        directions: directions.trim() || undefined,
      });
      setAddresses(data.addresses);
      selectAddress(data.address.id);
      router.back();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const ready = point && title.trim().length >= 2 && line1.trim().length >= 5 && district.trim().length >= 2;

  return (
    <Screen edges="none">
      <Header title="Adres ekle" back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xxxl }}
          keyboardShouldPersistTaps="handled"
        >
          <Card padded={false} style={{ overflow: "hidden" }}>
            {point ? (
              <MapView height={180} markers={[{ point, emoji: "🏠", color: t.colors.brand }]} />
            ) : (
              <View style={[styles.mapPlaceholder, { backgroundColor: t.colors.surface2 }]}>
                <Text variant="small">Konum alınıyor…</Text>
              </View>
            )}
          </Card>
          <Button
            label={locating ? "Konum alınıyor…" : "Konumumu yeniden al"}
            variant="secondary"
            icon={<Crosshair size={16} color={t.colors.ink} />}
            onPress={() => void locate()}
            loading={locating}
            fullWidth
          />

          <View>
            <SectionTitle title="Adres türü" />
            <View style={{ gap: t.spacing.sm }}>
              {ADDRESS_LABELS.map((item) => (
                <Option
                  key={item.id}
                  title={`${item.emoji}  ${item.name}`}
                  selected={label === item.id}
                  onPress={() => {
                    setLabel(item.id);
                    if (["Evim", "İş yerim", "Diğer"].includes(title)) {
                      setTitle(item.id === "ev" ? "Evim" : item.id === "is" ? "İş yerim" : "Diğer");
                    }
                  }}
                />
              ))}
            </View>
          </View>

          <Field label="Adres başlığı" value={title} onChangeText={setTitle} maxLength={40} />
          <Field label="Mahalle, cadde/sokak" value={line1} onChangeText={setLine1} placeholder="Caferağa Mah. Moda Cad." />
          <View style={styles.row}>
            <Field label="İlçe" value={district} onChangeText={setDistrict} containerStyle={{ flex: 1 }} />
            <Field label="Şehir" value={city} onChangeText={setCity} containerStyle={{ flex: 1 }} />
          </View>
          <View style={styles.row}>
            <Field label="Bina no" value={buildingNo} onChangeText={setBuildingNo} containerStyle={{ flex: 1 }} />
            <Field label="Kat" value={floor} onChangeText={setFloor} containerStyle={{ flex: 1 }} />
            <Field label="Daire" value={apartmentNo} onChangeText={setApartmentNo} containerStyle={{ flex: 1 }} />
          </View>
          <Field
            label="Adres tarifi (isteğe bağlı)"
            value={directions}
            onChangeText={setDirections}
            placeholder="Yeşil kapı, market üstü"
            multiline
            error={error}
          />
          <Button label="Adresi kaydet" onPress={save} loading={busy} disabled={!ready} size="lg" fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  mapPlaceholder: { height: 180, alignItems: "center", justifyContent: "center" },
});

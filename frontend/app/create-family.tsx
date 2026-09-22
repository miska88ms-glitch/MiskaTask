import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "phosphor-react-native";

import { ACCENTS, accentById, AVATARS, Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { Btn } from "@/src/components/ui";
import { ColorPickerSheet } from "@/src/components/color-picker-sheet";
import { useApp } from "@/src/app-context";
import { useToast } from "@/src/components/toast";

export default function CreateFamily() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { createFamily } = useApp();
  const toast = useToast();

  const [familyName, setFamilyName] = useState("");
  const [capoName, setCapoName] = useState("");
  const [avatar, setAvatar] = useState("👑");
  const [accent, setAccent] = useState("coral");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [colorSheet, setColorSheet] = useState(false);

  const a = accentById(accent);
  const canSubmit = familyName.trim().length > 0 && capoName.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    if (pin.length > 0 && pin.length !== 4) {
      toast("Il PIN deve avere 4 cifre", "error");
      return;
    }
    setLoading(true);
    try {
      await createFamily({
        family_name: familyName.trim(),
        capo_name: capoName.trim(),
        pin: pin || undefined,
        avatar,
        accent_color: accent,
      });
      // Gate routes to (tabs) once active member is set.
    } catch {
      toast("Impossibile creare la famiglia", "error");
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={styles.headerTitle}>Crea famiglia</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: Spacing.xl, paddingBottom: insets.bottom + 120, gap: Spacing.xl }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.field}>
          <Text style={styles.label}>Nome della famiglia</Text>
          <TextInput
            testID="input-family-name"
            value={familyName}
            onChangeText={setFamilyName}
            placeholder="Es. Famiglia Rossi"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Il tuo nome (capo famiglia)</Text>
          <TextInput
            testID="input-capo-name"
            value={capoName}
            onChangeText={setCapoName}
            placeholder="Es. Mamma"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Scegli un avatar</Text>
          <View style={styles.avatarGrid}>
            {AVATARS.map((em) => (
              <Pressable
                key={em}
                testID={`avatar-${em}`}
                onPress={() => setAvatar(em)}
                style={[
                  styles.avatarCell,
                  { backgroundColor: avatar === em ? a.soft : colors.surfaceSecondary, borderColor: avatar === em ? a.color : "transparent" },
                ]}
              >
                <Text style={{ fontSize: 26 }}>{em}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Colore preferito</Text>
          <View style={styles.accentRow}>
            {ACCENTS.map((ac) => (
              <Pressable
                key={ac.id}
                testID={`accent-${ac.id}`}
                onPress={() => setAccent(ac.id)}
                style={[styles.accentDot, { backgroundColor: ac.color, borderColor: accent === ac.id ? colors.onSurface : "transparent" }]}
              />
            ))}
            <Pressable
              testID="custom-color-btn"
              onPress={() => setColorSheet(true)}
              style={[styles.accentDot, styles.customDot, { backgroundColor: accent.startsWith("#") ? accent : colors.surfaceTertiary, borderColor: accent.startsWith("#") ? colors.onSurface : colors.border }]}
            >
              <Text style={{ fontSize: 18 }}>🎨</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>PIN (facoltativo)</Text>
          <TextInput
            testID="input-pin"
            value={pin}
            onChangeText={(t) => setPin(t.replace(/[^0-9]/g, "").slice(0, 4))}
            placeholder="4 cifre per proteggere il profilo"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            secureTextEntry
            style={styles.input}
          />
        </View>

        <Btn label="Crea famiglia" testID="submit-create-family" accent={accent} loading={loading} disabled={!canSubmit} onPress={submit} />
        <Text style={styles.codeNote}>
          🔑 Dopo la creazione riceverai un <Text style={styles.codeNoteBold}>codice invito</Text> da condividere con i tuoi familiari per farli entrare dai loro telefoni.
        </Text>
      </KeyboardAwareScrollView>

      <ColorPickerSheet visible={colorSheet} onClose={() => setColorSheet(false)} initial={accent.startsWith("#") ? accent : "#FF6B6B"} onSelect={setAccent} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontFamily: Fonts.displayBold, fontSize: FontSize.xl, color: colors.onSurface },
  field: { gap: Spacing.sm },
  label: { fontFamily: Fonts.bodyBold, fontSize: FontSize.base, color: colors.onSurface },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontFamily: Fonts.bodySemibold,
    fontSize: FontSize.lg,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  avatarCell: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  accentRow: { flexDirection: "row", gap: Spacing.md, flexWrap: "wrap" },
  accentDot: { width: 44, height: 44, borderRadius: Radius.pill, borderWidth: 3 },
  customDot: { alignItems: "center", justifyContent: "center" },
  codeNote: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.muted, textAlign: "center", lineHeight: 20 },
  codeNoteBold: { fontFamily: Fonts.bodyBold, color: colors.onSurface },
}));

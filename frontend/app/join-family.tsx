import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, UsersThree } from "phosphor-react-native";

import { Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { Btn } from "@/src/components/ui";
import { useApp } from "@/src/app-context";
import { useToast } from "@/src/components/toast";

export default function JoinFamily() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { joinFamily } = useApp();
  const toast = useToast();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (code.trim().length < 4) {
      toast("Inserisci il codice famiglia", "error");
      return;
    }
    setLoading(true);
    try {
      await joinFamily(code.trim().toUpperCase());
      // Gate routes to member selection once family is joined.
    } catch {
      toast("Codice non valido", "error");
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable testID="join-back-btn" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={styles.headerTitle}>Unisciti</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.xl }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.badge}>
            <UsersThree size={40} color={colors.brandPrimary} weight="fill" />
          </View>
          <Text style={styles.title}>Unisciti a una famiglia</Text>
          <Text style={styles.sub}>
            Inserisci il codice invito che ti ha dato il capo famiglia. Poi scegli il tuo profilo.
          </Text>
        </View>

        <TextInput
          testID="input-invite-code"
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6))}
          placeholder="ES. T6JQDB"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          style={styles.input}
        />

        <Btn label="Entra nella famiglia" testID="submit-join-btn" loading={loading} onPress={submit} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: Radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: Fonts.displayBold, fontSize: FontSize.xl, color: colors.onSurface },
  hero: { alignItems: "center", gap: Spacing.md, marginTop: Spacing.lg },
  badge: { width: 84, height: 84, borderRadius: Radius.lg, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: Fonts.displayBold, fontSize: FontSize.xxl, color: colors.onSurface },
  sub: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.muted, textAlign: "center", lineHeight: 22, paddingHorizontal: Spacing.md },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 16,
    fontFamily: Fonts.displayBold,
    fontSize: FontSize.xxl,
    letterSpacing: 4,
    textAlign: "center",
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
}));

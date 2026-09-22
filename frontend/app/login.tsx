import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GoogleLogo, HouseLine, Sparkle } from "phosphor-react-native";

import { Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { Btn } from "@/src/components/ui";
import { useApp } from "@/src/app-context";
import { useToast } from "@/src/components/toast";

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signInWithGoogle } = useApp();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const google = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      toast("Accesso non riuscito, riprova", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.xxxl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <HouseLine size={44} color={colors.onBrandPrimary} weight="fill" />
          </View>
          <Text style={styles.appName}>FamigliaTask</Text>
          <Text style={styles.tagline}>
            I compiti di casa diventano un gioco di squadra. Assegna, completa e scala la classifica!
          </Text>
        </View>

        <View style={styles.bullets}>
          {[
            { e: "🧹", t: "Compiti preimpostati o personalizzati" },
            { e: "📅", t: "Calendario condiviso della famiglia" },
            { e: "🏆", t: "Punti, premi e classifica" },
          ].map((b) => (
            <View key={b.t} style={styles.bullet}>
              <Text style={{ fontSize: 24 }}>{b.e}</Text>
              <Text style={styles.bulletText}>{b.t}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Btn
            label="Crea la tua famiglia"
            testID="create-family-btn"
            icon={<Sparkle size={22} color={colors.onBrandPrimary} weight="fill" />}
            onPress={() => router.push("/create-family")}
          />
          <Btn
            label="Accedi con Google"
            testID="google-login-btn"
            variant="ghost"
            loading={loading}
            icon={<GoogleLogo size={22} color={colors.brandPrimary} weight="fill" />}
            onPress={google}
          />
          <Text style={styles.hint}>
            Crea una famiglia per iniziare subito, oppure accedi con Google come capo famiglia.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: Spacing.xl, gap: Spacing.xxl, flexGrow: 1, justifyContent: "space-between" },
  hero: { alignItems: "center", gap: Spacing.md },
  logoBadge: {
    width: 92,
    height: 92,
    borderRadius: Radius.lg,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brandPrimary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  appName: { fontFamily: Fonts.displayBold, fontSize: FontSize.huge, color: colors.onSurface },
  tagline: {
    fontFamily: Fonts.body,
    fontSize: FontSize.lg,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: Spacing.md,
  },
  bullets: { gap: Spacing.md },
  bullet: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: colors.surfaceSecondary,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  bulletText: { fontFamily: Fonts.bodySemibold, fontSize: FontSize.base, color: colors.onSurface, flex: 1 },
  actions: { gap: Spacing.md },
  hint: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.muted, textAlign: "center" },
}));

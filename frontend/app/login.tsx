import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DeviceMobile, HouseLine, Sparkle, UsersThree } from "phosphor-react-native";

import { Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { Btn } from "@/src/components/ui";

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const focused = useIsFocused();

  // A previous login route can remain in Stack history after sign-out.
  // Don't keep hidden duplicate interactive controls mounted behind the active page.
  if (!focused) return null;

  return (
    <View testID="login-screen" style={styles.root}>
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
          <Text style={styles.appName}>Family Task</Text>
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
            label="Unisciti con un codice"
            testID="join-family-btn"
            variant="soft"
            icon={<UsersThree size={22} color={colors.brandPrimary} weight="fill" />}
            onPress={() => router.push("/join-family")}
          />
          <Text style={styles.hint}>
            Crea una famiglia come capo, oppure unisciti con il codice invito ricevuto.
          </Text>
          {Platform.OS === "web" && <Pressable testID="login-install-app-button" accessibilityRole="button" onPress={() => router.push("/install-app")} style={({ pressed }) => [styles.installLink, { opacity: pressed ? 0.7 : 1 }]}>
            <DeviceMobile size={20} color={colors.onBrandTertiary} weight="fill" />
            <Text testID="login-install-app-label" style={styles.installText}>Family Task sulla Home del telefono</Text>
          </Pressable>}
          <Text testID="dev-credit" style={styles.devCredit}>Miska (Developer)</Text>
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
  devCredit: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: colors.muted,
    textAlign: "center",
    opacity: 0.6,
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
  },  bullet: {
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
  installLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, minHeight: 48, marginTop: Spacing.sm },
  installText: { flexShrink: 1, fontFamily: Fonts.bodyBold, fontSize: FontSize.base, color: colors.onBrandTertiary },
}));

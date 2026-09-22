import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, CheckCircle, DeviceMobile, DownloadSimple } from "phosphor-react-native";
import { Btn } from "@/src/components/ui";
import { WebPushSettings } from "@/src/components/web-push-settings";
import { usePwa } from "@/src/pwa/context";
import { Fonts, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";

const GUIDES = {
  apple: ["Apri il link di Family Task in Safari.", "Tocca Condividi (il quadrato con la freccia verso l’alto).", "Scegli Aggiungi alla schermata Home e conferma Aggiungi.", "Apri Family Task dalla nuova icona sulla Home."],
  android: ["Apri il link di Family Task in Chrome.", "Tocca il menu del browser (i tre puntini).", "Scegli Installa app oppure Aggiungi a schermata Home e conferma.", "Apri Family Task dalla nuova icona sulla Home."],
};

export default function InstallApp() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pwa = usePwa();
  const [selected, setSelected] = useState<"apple" | "android" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const platform = selected ?? (pwa.isApple ? "apple" : "android");
  const install = async () => {
    setBusy(true); setMessage(null);
    try { const accepted = await pwa.install(); setMessage(accepted ? "Completa l’installazione nel browser, poi apri la nuova icona." : "Nessun problema: puoi installarla più tardi o seguire i passaggi qui sotto."); }
    catch { setMessage("Il browser non ha completato l’installazione. Segui i passaggi qui sotto."); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.root} testID="install-app-screen">
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.xxl }]}>
        <Pressable testID="install-back-button" accessibilityRole="button" accessibilityLabel="Indietro" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}>
          <ArrowLeft size={24} color={colors.onSurface} /><Text style={styles.backText}>Indietro</Text>
        </Pressable>
        <View style={styles.hero}>
          <View style={styles.icon}><DeviceMobile size={38} color={colors.onBrandPrimary} weight="fill" /></View>
          <Text testID="install-app-title" style={styles.title}>La tua famiglia,{"\n"}a un tocco.</Text>
          <Text testID="install-app-description" style={styles.subtitle}>Family Task sul tuo Android, iPhone o iPad. Si apre dalla Home, senza passare dagli store.</Text>
        </View>
        {pwa.installed ? <View style={styles.installed} testID="pwa-installed-status"><CheckCircle size={24} color={colors.success} weight="fill" /><Text style={styles.installedText}>Stai usando l’app dalla Home</Text></View>
          : pwa.canInstall && <Btn label="Installa Family Task" testID="install-pwa-button" loading={busy} onPress={install} icon={<DownloadSimple size={20} color={colors.onBrandPrimary} />} />}
        {message && <Text testID="install-feedback" accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}
        {pwa.error && <Text testID="install-unavailable-message" style={styles.body}>{pwa.error}</Text>}
        {!pwa.installed && <View style={styles.card}>
          <Text testID="install-guide-title" style={styles.cardTitle}>Aggiungila alla Home</Text>
          <View style={styles.tabs}>
            {(["android", "apple"] as const).map((key) => <Pressable key={key} testID={`install-guide-${key}-button`} accessibilityRole="button" accessibilityState={{ selected: platform === key }} onPress={() => setSelected(key)} style={({ pressed }) => [styles.tab, platform === key && styles.tabSelected, { opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[styles.tabText, platform === key && styles.tabTextSelected]}>{key === "apple" ? "iPhone / iPad" : "Android"}</Text>
            </Pressable>)}
          </View>
          {GUIDES[platform].map((text, index) => <View style={styles.step} key={`${platform}-${index}`} testID={`install-step-${index + 1}`}>
            <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View><Text style={styles.body}>{text}</Text>
          </View>)}
          <Text testID="install-browser-note" style={styles.note}>Se hai aperto il link da WhatsApp o un’altra app, aprilo prima nel browser. I nomi dei menu possono variare.</Text>
        </View>}
        <WebPushSettings />
        <View style={styles.card}>
          <Text testID="install-sync-title" style={styles.cardTitle}>Sempre la stessa famiglia</Text>
          <Text testID="install-sync-description" style={styles.body}>Compiti, calendario, chat e premi si sincronizzano online. Per entrare da un altro telefono o dalla nuova icona, usa il codice invito e scegli il tuo profilo.</Text>
          <Text testID="install-online-note" style={styles.note}>Serve una connessione Internet. La webapp non salva modifiche offline.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: Spacing.xl, gap: Spacing.xl, width: "100%", maxWidth: 680, alignSelf: "center" },
  back: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, minHeight: 44, alignSelf: "flex-start" },
  backText: { fontFamily: Fonts.bodyBold, color: colors.onSurface, fontSize: 16 },
  hero: { gap: Spacing.lg, alignItems: "center", paddingVertical: Spacing.md },
  icon: { width: 76, height: 76, borderRadius: Radius.lg, backgroundColor: colors.brandPrimary, justifyContent: "center", alignItems: "center" },
  title: { fontFamily: Fonts.displayBold, fontSize: 32, lineHeight: 38, color: colors.onSurface, textAlign: "center" },
  subtitle: { fontFamily: Fonts.body, fontSize: 16, lineHeight: 24, color: colors.muted, textAlign: "center" },
  card: { backgroundColor: colors.surfaceSecondary, padding: Spacing.xl, borderRadius: Radius.lg, gap: Spacing.xl },
  cardTitle: { fontFamily: Fonts.displayBold, fontSize: 22, color: colors.onSurface },
  tabs: { flexDirection: "row", padding: 4, backgroundColor: colors.surfaceTertiary, borderRadius: Radius.pill },
  tab: { flex: 1, minHeight: 44, borderRadius: Radius.pill, justifyContent: "center", alignItems: "center" },
  tabSelected: { backgroundColor: colors.brandPrimary },
  tabText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: colors.muted },
  tabTextSelected: { color: colors.onBrandPrimary },
  step: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  number: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary },
  numberText: { fontFamily: Fonts.bodyExtra, fontSize: 14, color: colors.onBrandTertiary },
  body: { flexShrink: 1, fontFamily: Fonts.body, fontSize: 16, lineHeight: 24, color: colors.onSurface },
  note: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 20, color: colors.muted },
  installed: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: Radius.lg },
  installedText: { flex: 1, fontFamily: Fonts.bodyBold, fontSize: 16, color: colors.success },
}));
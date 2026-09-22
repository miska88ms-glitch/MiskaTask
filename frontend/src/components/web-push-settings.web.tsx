import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Bell } from "phosphor-react-native";
import { api } from "@/src/api";
import { useApp } from "@/src/app-context";
import { usePwa } from "@/src/pwa/context";
import { detachWebPush, publicKeyBytes, webPushSupported, webRegistration } from "@/src/pwa/web-push.web";
import { Btn } from "./ui";
import { Fonts, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";

export function WebPushSettings() {
  const { activeMember } = useApp();
  const pwa = usePwa();
  const styles = useStyles();
  const { colors } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [retry, setRetry] = useState(0);
  const memberId = activeMember?.member_id;
  const supported = webPushSupported();
  const needsInstall = pwa.isApple && !pwa.installed;

  useEffect(() => {
    if (!memberId || !supported || needsInstall || !pwa.ready) return;
    let cancelled = false;
    setLoading(true); setError(null);
    setPermission(Notification.permission);
    (async () => {
      const config = await api.webPushConfig();
      const registration = await webRegistration();
      const subscription = await registration.pushManager.getSubscription();
      const state = subscription ? await api.webPushStatus(subscription.endpoint) : { enabled: false };
      if (!cancelled) { setKey(config.publicKey); setEnabled(state.enabled); }
    })().catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [memberId, supported, needsInstall, pwa.ready, retry]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(null); setMessage(null);
    try { await action(); } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita. Riprova.");
    } finally { setBusy(false); }
  };

  const enable = () => run(async () => {
    // This call is BEFORE any network await, preserving Safari's user gesture.
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") throw new Error(result === "denied" ? "Notifiche bloccate. Consenti gli avvisi nelle impostazioni del browser o dell’app." : "Permesso non concesso. Puoi riprovare quando vuoi.");
    const registration = await webRegistration();
    let subscription = await registration.pushManager.getSubscription();
    const bytes = publicKeyBytes(key!);
    if (subscription && subscription.options.applicationServerKey &&
        String(new Uint8Array(subscription.options.applicationServerKey)) !== String(bytes)) {
      await detachWebPush(); subscription = null;
    }
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
    try { await api.saveWebPush(subscription.toJSON()); } catch (e) {
      await subscription.unsubscribe().catch(() => false);
      throw e;
    }
    setEnabled(true); setMessage("Notifiche attive per questo profilo su questo dispositivo.");
  });

  const disable = () => run(async () => {
    await detachWebPush(); setEnabled(false); setMessage("Notifiche disattivate su questo dispositivo.");
  });
  const test = () => run(async () => {
    const subscription = await (await webRegistration()).pushManager.getSubscription();
    if (!subscription) { setEnabled(false); throw new Error("Attiva di nuovo le notifiche."); }
    await api.testWebPush(subscription.endpoint);
    setMessage("Avviso accettato dal servizio notifiche. Controlla le notifiche del dispositivo.");
  });

  const explanation = !activeMember ? "Entra nella famiglia e seleziona il tuo profilo per attivare gli avvisi."
    : needsInstall ? "Su iPhone e iPad (iOS 16.4 o successivo), aggiungi Family Task alla Home e aprila dall’icona prima di attivare le notifiche."
    : !supported ? "Questo browser non supporta gli avvisi push. Compiti, chat e calendario restano disponibili nell’app."
    : permission === "denied" ? "Gli avvisi sono bloccati su questo dispositivo. Puoi consentirli nelle impostazioni; nel frattempo tutte le funzioni dell’app restano disponibili."
    : enabled ? "Ricevi avvisi per compiti assegnati, messaggi e completamenti, anche con l’app chiusa."
    : "Scegli se ricevere avvisi per compiti, chat e completamenti. Ti chiederemo il permesso solo quando tocchi Attiva.";

  return (
    <View testID="web-push-settings" style={styles.card}>
      <View style={styles.heading}><Bell size={24} weight="fill" color={colors.brandPrimary} /><Text testID="web-push-title" style={styles.title}>Notifiche sul dispositivo</Text></View>
      <Text testID="web-push-explanation" style={styles.body}>{explanation}</Text>
      {!!activeMember && supported && !needsInstall && <>
        <Text testID="web-push-status" style={[styles.status, { color: permission === "denied" ? colors.warning : enabled ? colors.success : colors.muted }]}>{permission === "denied" ? "Bloccate nelle impostazioni" : enabled ? "Attive per questo profilo" : "Non attive"}</Text>
        {loading && <ActivityIndicator testID="web-push-loading" color={colors.brandPrimary} />}
        {permission !== "denied" && !enabled && <Btn label="Attiva notifiche" testID="enable-web-push-button" onPress={enable} loading={busy} disabled={!key || !pwa.ready || !pwa.online || loading} />}
        {enabled && <>
          <Btn label="Invia una notifica di prova" testID="test-web-push-button" onPress={test} disabled={!pwa.online} loading={busy} />
          <Btn label="Disattiva su questo dispositivo" testID="disable-web-push-button" onPress={disable} variant="soft" disabled={busy} />
        </>}
        {permission === "denied" && <Text testID="web-push-blocked-help" style={styles.body}>Apri le impostazioni delle notifiche per Family Task sul telefono, oppure i permessi del sito nel browser, e consenti gli avvisi.</Text>}
        {error && <Btn label="Ricontrolla disponibilità" testID="retry-web-push-button" variant="soft" disabled={busy || loading || !pwa.online} onPress={() => setRetry((n) => n + 1)} />}
      </>}
      {error && <Text testID="web-push-error" accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {message && <Text testID="web-push-feedback" accessibilityLiveRegion="polite" style={styles.status}>{message}</Text>}
      <Text testID="web-push-privacy-note" style={styles.note}>Gli avvisi sono personali: cambiando profilo o uscendo dalla famiglia, vengono disattivati su questo dispositivo.</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.lg },
  heading: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  title: { flex: 1, fontFamily: Fonts.displayBold, fontSize: 20, color: colors.onSurface },
  body: { fontFamily: Fonts.body, fontSize: 16, lineHeight: 24, color: colors.muted },
  status: { fontFamily: Fonts.bodyBold, fontSize: 14, color: colors.success },
  error: { fontFamily: Fonts.bodySemibold, fontSize: 14, color: colors.error },
  note: { fontFamily: Fonts.body, fontSize: 12, lineHeight: 18, color: colors.muted },
}));
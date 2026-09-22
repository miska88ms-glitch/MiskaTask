import { useEffect, useState, type PropsWithChildren } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onlineManager } from "@tanstack/react-query";
import { PwaContext } from "./context";
import { Fonts, makeStyles, Spacing } from "@/src/theme";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaProvider({ children }: PropsWithChildren) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isApple, setIsApple] = useState(false);
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const syncDisplay = () => setInstalled(display.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const syncOnline = () => { setOnline(navigator.onLine); onlineManager.setOnline(navigator.onLine); };
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const installedEvent = () => { setInstalled(true); setPrompt(null); };
    setIsApple(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    syncDisplay(); syncOnline();
    display.addEventListener("change", syncDisplay);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installedEvent);
    let stopped = false;
    if (window.isSecureContext && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => {
        if (stopped) return;
        const check = () => {
          if (stopped) return;
          setReady(!!registration.active);
          if (registration.waiting && navigator.serviceWorker.controller) setUpdate(registration.waiting);
        };
        check();
        navigator.serviceWorker.ready.then(() => { if (!stopped) setReady(true); });
        registration.addEventListener("updatefound", () => registration.installing?.addEventListener("statechange", check));
        registration.update().catch(() => { /* Offline update checks can fail harmlessly. */ });
      }).catch(() => { if (!stopped) setError("Installazione non disponibile ora. Puoi continuare a usare Family Task nel browser."); });
    } else setError("Per installare l’app usa un browser aggiornato e una connessione HTTPS.");
    return () => {
      stopped = true;
      display.removeEventListener("change", syncDisplay);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installedEvent);
    };
  }, []);

  const install = async () => {
    if (!prompt) return false;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      // Only appinstalled/display-mode confirms installation actually finished.
      return choice.outcome === "accepted";
    } finally { setPrompt(null); }
  };
  const applyUpdate = () => {
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    update?.postMessage({ type: "ACTIVATE_UPDATE" });
  };

  return (
    <PwaContext.Provider value={{ installed, isApple, canInstall: !!prompt, online, ready, error, install }}>
      {!online && <View style={[styles.banner, { paddingTop: insets.top + Spacing.sm }]} testID="connection-offline-banner">
        <Text accessibilityLiveRegion="polite" testID="connection-offline-message" style={styles.message}>Sei offline. Le modifiche non vengono salvate.</Text>
      </View>}
      {update && online && <View style={[styles.banner, { paddingTop: insets.top + Spacing.sm }]} testID="app-update-banner">
        <Text testID="app-update-message" style={styles.message}>È disponibile una nuova versione. Salva prima le modifiche.</Text>
        <Pressable testID="app-update-button" accessibilityRole="button" onPress={applyUpdate} style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}>
          <Text style={styles.link}>Aggiorna</Text>
        </Pressable>
      </View>}
      {children}
    </PwaContext.Provider>
  );
}

const useStyles = makeStyles((colors) => ({
  banner: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: Spacing.xs },
  message: { color: colors.onSurface, fontFamily: Fonts.bodySemibold, fontSize: 14, textAlign: "center" },
  button: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  link: { color: colors.onBrandTertiary, fontFamily: Fonts.bodyBold, fontSize: 16 },
}));
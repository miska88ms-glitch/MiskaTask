import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { LogBox } from "react-native";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { AppProvider, useApp } from "@/src/app-context";
import { ToastProvider } from "@/src/components/toast";
import { storage } from "@/src/utils/storage";
import { Fonts, FontSize, Radius, Spacing, useTheme } from "@/src/theme";
import { PwaProvider } from "@/src/pwa/provider";

LogBox.ignoreAllLogs(true);

// Push: foreground handler (module scope, native only)
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Push: Android channel (module scope)
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Notifiche",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

function Gate() {
  const { status, activeMember } = useApp();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();
  const [nudge, setNudge] = useState(false);

  // Routing gate
  useEffect(() => {
    if (status === "loading") return;
    const root = segments[0];

    if (status === "unauth") {
      if (root !== "login" && root !== "create-family" && root !== "join-family" && root !== "install-app") router.replace("/login");
      return;
    }
    if (!activeMember) {
      if (root !== "select-member" && root !== "install-app") router.replace("/select-member");
      return;
    }
    if (root !== "(tabs)" && root !== "manage-members" && root !== "task" && root !== "rewards" && root !== "install-app") router.replace("/(tabs)");
  }, [status, activeMember, segments, router]);

  // Push: tap handlers + denied nudge
  useEffect(() => {
    if (Platform.OS === "web") return;

    const routeFrom = (data: Record<string, unknown> | undefined) => {
      const url = (data?.action_url || data?.deeplink) as string | undefined;
      if (!url) return;
      if (url.startsWith("http")) Linking.openURL(url);
      else router.push(url as never);
    };

    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      routeFrom(response.notification.request.content.data);
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) routeFrom(response.notification.request.content.data);
    });

    (async () => {
      const { status: perm, canAskAgain } = await Notifications.getPermissionsAsync();
      if (perm !== "denied" || canAskAgain) return;
      const last = await storage.getItem<number>("pushNudgeAt", 0);
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (last && Date.now() - Number(last) <= oneWeek) return;
      setNudge(true);
    })();

    return () => tapSub.remove();
  }, [router]);

  const dismissNudge = async () => {
    await storage.setItem("pushNudgeAt", Date.now());
    setNudge(false);
  };

  if (status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="create-family" />
        <Stack.Screen name="join-family" />
        <Stack.Screen name="install-app" />
        <Stack.Screen name="select-member" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="manage-members" />
        <Stack.Screen name="rewards" />
        <Stack.Screen name="task/[id]" />
      </Stack>

      <Modal visible={nudge} transparent animationType="fade" onRequestClose={dismissNudge}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: Spacing.xl }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.md }}>
            <Text style={{ fontFamily: Fonts.displayBold, fontSize: FontSize.xl, color: colors.onSurface }}>
              Attiva le notifiche 🔔
            </Text>
            <Text style={{ fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.muted, lineHeight: 22 }}>
              Per ricevere avvisi su nuovi compiti e messaggi, attiva le notifiche dalle impostazioni.
            </Text>
            <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm }}>
              <Pressable
                testID="nudge-later"
                onPress={dismissNudge}
                style={{ flex: 1, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center" }}
              >
                <Text style={{ fontFamily: Fonts.bodyBold, color: colors.onSurface }}>Più tardi</Text>
              </Pressable>
              <Pressable
                testID="nudge-settings"
                onPress={() => {
                  Linking.openSettings();
                  dismissNudge();
                }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center" }}
              >
                <Text style={{ fontFamily: Fonts.bodyBold, color: colors.onBrandPrimary }}>Impostazioni</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Fredoka-Medium": require("../assets/fonts/Fredoka-Medium.ttf"),
    "Fredoka-SemiBold": require("../assets/fonts/Fredoka-SemiBold.ttf"),
    "Fredoka-Bold": require("../assets/fonts/Fredoka-Bold.ttf"),
    "Nunito-Regular": require("../assets/fonts/Nunito-Regular.ttf"),
    "Nunito-SemiBold": require("../assets/fonts/Nunito-SemiBold.ttf"),
    "Nunito-Bold": require("../assets/fonts/Nunito-Bold.ttf"),
    "Nunito-ExtraBold": require("../assets/fonts/Nunito-ExtraBold.ttf"),
  });

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <KeyboardProvider>
              <StatusBar style="dark" />
              {fontsLoaded ? (
                <AppProvider>
                  <ToastProvider>
                    <PwaProvider><Gate /></PwaProvider>
                  </ToastProvider>
                </AppProvider>
              ) : (
                <View style={{ flex: 1, backgroundColor: "#FFF9F6" }} />
              )}
            </KeyboardProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

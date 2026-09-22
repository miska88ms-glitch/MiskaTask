import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { House, CalendarBlank, Trophy, User } from "phosphor-react-native";

import { accentById, Fonts, useTheme } from "@/src/theme";
import { useAccent } from "@/src/app-context";
import { usesNativeTabs } from "@/src/navigation";

export default function TabsLayout() {
  const { colors } = useTheme();
  const accent = accentById(useAccent()).color;
  const insets = useSafeAreaInsets();

  if (usesNativeTabs) {
    // Lazy require so non-iOS bundlers never touch the native module.
    const { NativeTabs } = require("expo-router/unstable-native-tabs");
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="house.fill" />
          <NativeTabs.Trigger.Label>Oggi</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="calendario">
          <NativeTabs.Trigger.Icon sf="calendar" />
          <NativeTabs.Trigger.Label>Calendario</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="classifica">
          <NativeTabs.Trigger.Icon sf="trophy.fill" />
          <NativeTabs.Trigger.Label>Classifica</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profilo">
          <NativeTabs.Trigger.Icon sf="person.fill" />
          <NativeTabs.Trigger.Label>Profilo</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          ...(Platform.OS === "web" ? { height: 64 + insets.bottom, paddingBottom: insets.bottom } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: Fonts.bodyBold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Oggi", tabBarButtonTestID: "tab-today-button", tabBarIcon: ({ color }) => <House size={26} color={String(color)} weight="fill" /> }}
      />
      <Tabs.Screen
        name="calendario"
        options={{ title: "Calendario", tabBarButtonTestID: "tab-calendar-button", tabBarIcon: ({ color }) => <CalendarBlank size={26} color={String(color)} weight="fill" /> }}
      />
      <Tabs.Screen
        name="classifica"
        options={{ title: "Classifica", tabBarButtonTestID: "tab-leaderboard-button", tabBarIcon: ({ color }) => <Trophy size={26} color={String(color)} weight="fill" /> }}
      />
      <Tabs.Screen
        name="profilo"
        options={{ title: "Profilo", tabBarButtonTestID: "tab-profile-button", tabBarIcon: ({ color }) => <User size={26} color={String(color)} weight="fill" /> }}
      />
    </Tabs>
  );
}

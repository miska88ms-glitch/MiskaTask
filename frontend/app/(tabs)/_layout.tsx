import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { House, CalendarBlank, Trophy, User } from "phosphor-react-native";

import { accentById, Fonts, useTheme } from "@/src/theme";
import { useAccent } from "@/src/app-context";
import { usesNativeTabs } from "@/src/navigation";

export default function TabsLayout() {
  const { colors } = useTheme();
  const accent = accentById(useAccent()).color;

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
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: Fonts.bodyBold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Oggi", tabBarIcon: ({ color }) => <House size={26} color={color} weight="fill" /> }}
      />
      <Tabs.Screen
        name="calendario"
        options={{ title: "Calendario", tabBarIcon: ({ color }) => <CalendarBlank size={26} color={color} weight="fill" /> }}
      />
      <Tabs.Screen
        name="classifica"
        options={{ title: "Classifica", tabBarIcon: ({ color }) => <Trophy size={26} color={color} weight="fill" /> }}
      />
      <Tabs.Screen
        name="profilo"
        options={{ title: "Profilo", tabBarIcon: ({ color }) => <User size={26} color={color} weight="fill" /> }}
      />
    </Tabs>
  );
}

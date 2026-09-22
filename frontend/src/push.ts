import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "@/src/api";

// Registers this device for push under the given id (we use the active
// member_id as the push "user_id"). Best-effort: silently no-ops on web / Expo
// Go / when permission is denied — never blocks the app.
export async function registerForPush(userId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await api.registerPush({ user_id: userId, platform: Platform.OS, device_token: String(tokenResp.data) });
  } catch {
    // Push not available in this environment (e.g. Expo Go) — ignore.
  }
}

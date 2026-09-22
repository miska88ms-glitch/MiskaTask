import { Platform } from "react-native";

// iOS 26+ gets native Liquid Glass tabs; everything else uses the classic
// JS tab bar. "unstable" refers only to the import path — it is production-ready.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

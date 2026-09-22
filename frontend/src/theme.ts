// Design tokens for FamigliaTask — Tactile / Playful, light theme.
// Colors mirror the "color" block of /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFF9F6",
  onSurface: "#2C2A28",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#2C2A28",
  surfaceTertiary: "#F2EBE7",
  onSurfaceTertiary: "#54504C",
  surfaceInverse: "#2C2A28",
  onSurfaceInverse: "#FFF9F6",
  muted: "#7A736E",

  brand: "#FF6B6B",
  onBrand: "#FFFFFF",
  brandPrimary: "#FF6B6B",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FFD93D",
  onBrandSecondary: "#2C2A28",
  brandTertiary: "#FFEEEE",
  onBrandTertiary: "#CC3333",

  success: "#22A559",
  onSuccess: "#FFFFFF",
  warning: "#B45309",
  onWarning: "#FFFFFF",
  error: "#EF4444",
  onError: "#FFFFFF",
  info: "#F2EBE7",
  onInfo: "#2C2A28",

  border: "#E8DFD8",
  borderStrong: "#D1C5BC",
  divider: "#E8DFD8",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// --------------------------------------------------------------------------- //
// Typography (loaded in app/_layout.tsx via expo-font)
// --------------------------------------------------------------------------- //
export const Fonts = {
  displayMedium: "Fredoka-Medium",
  display: "Fredoka-SemiBold",
  displayBold: "Fredoka-Bold",
  body: "Nunito-Regular",
  bodySemibold: "Nunito-SemiBold",
  bodyBold: "Nunito-Bold",
  bodyExtra: "Nunito-ExtraBold",
} as const;

export const FontSize = { sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, huge: 34 } as const;
export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const Radius = { sm: 8, md: 16, lg: 24, pill: 999 } as const;

// --------------------------------------------------------------------------- //
// Per-user customizable accent colors (NO blue / purple).
// --------------------------------------------------------------------------- //
export type AccentDef = { id: string; label: string; color: string; soft: string; on: string };

export const ACCENTS: AccentDef[] = [
  { id: "coral", label: "Corallo", color: "#FF6B6B", soft: "#FFE5E5", on: "#FFFFFF" },
  { id: "mint", label: "Menta", color: "#22A559", soft: "#DCF6E7", on: "#FFFFFF" },
  { id: "amber", label: "Sole", color: "#F59E0B", soft: "#FDEECB", on: "#FFFFFF" },
  { id: "pink", label: "Fragola", color: "#EC4899", soft: "#FBDCEC", on: "#FFFFFF" },
  { id: "teal", label: "Laguna", color: "#14B8A6", soft: "#CFF3EE", on: "#FFFFFF" },
  { id: "berry", label: "Ciliegia", color: "#E11D48", soft: "#FBD5DD", on: "#FFFFFF" },
];

export function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#2C2A28" : "#FFFFFF";
}

export function accentById(value: string | undefined | null): AccentDef {
  if (value && value.startsWith("#")) {
    return { id: value, label: "Personalizzato", color: value, soft: value + "22", on: readableOn(value) };
  }
  return ACCENTS.find((a) => a.id === value) ?? ACCENTS[0];
}

// Distinct category color for personal commitments ("impegni") so they never
// look like assignable chores. A calm slate, different from all member accents.
export const IMPEGNO: AccentDef = { id: "impegno", label: "Impegno", color: "#475569", soft: "#E7ECF2", on: "#FFFFFF" };

// --------------------------------------------------------------------------- //
// Avatars (emoji) for family members
// --------------------------------------------------------------------------- //
export const AVATARS = [
  "🦁", "🐼", "🦊", "🐸", "🐵", "🦄",
  "🐯", "🐨", "🐷", "🐰", "🐻", "🐮",
  "🐶", "🐱", "🐹", "🐔", "🐧", "🦉",
  "🦖", "🐢", "🐙", "🦋", "🐝", "🐳",
  "👑", "⭐", "🚀", "🌈", "🍀", "⚽",
];

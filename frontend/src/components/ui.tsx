import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { accentById, Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { getIcon } from "@/src/icons";

const softShadow: ViewStyle = {
  shadowColor: "#8A7A6E",
  shadowOpacity: 0.16,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export function haptic(kind: "light" | "medium" | "success" | "selection" = "light") {
  if (Platform.OS === "web") return;
  if (kind === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === "selection") Haptics.selectionAsync();
  else
    Haptics.impactAsync(
      kind === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
}

// --------------------------------------------------------------------------- //
export function Card({
  children,
  style,
  testID,
}: PropsWithChildren<{ style?: ViewStyle; testID?: string }>) {
  const styles = useStyles();
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

// --------------------------------------------------------------------------- //
type BtnProps = {
  label: string;
  onPress: () => void;
  accent?: string; // accent id
  variant?: "solid" | "soft" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  testID?: string;
  fullWidth?: boolean;
};

export function Btn({
  label,
  onPress,
  accent = "coral",
  variant = "solid",
  disabled,
  loading,
  icon,
  testID,
  fullWidth = true,
}: BtnProps) {
  const { colors } = useTheme();
  const a = accentById(accent);
  const bg = variant === "solid" ? a.color : variant === "soft" ? a.soft : "transparent";
  const fg = variant === "solid" ? a.on : a.color;
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        haptic("medium");
        onPress();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: Radius.pill,
          paddingVertical: 15,
          paddingHorizontal: Spacing.xl,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Spacing.sm,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          borderWidth: variant === "ghost" ? 2 : 0,
          borderColor: colors.border,
        },
        variant === "solid" ? softShadow : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <Text style={{ color: fg, fontFamily: Fonts.displayBold, fontSize: FontSize.lg }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// --------------------------------------------------------------------------- //
export function IconBubble({
  icon,
  color,
  size = 28,
  bubble = 56,
}: {
  icon: string;
  color: string;
  size?: number;
  bubble?: number;
}) {
  const a = accentById(color);
  const Icon = getIcon(icon);
  return (
    <View
      style={{
        width: bubble,
        height: bubble,
        borderRadius: Radius.md,
        backgroundColor: a.soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={size} color={a.color} weight="fill" />
    </View>
  );
}

// --------------------------------------------------------------------------- //
export function Avatar({
  emoji,
  accent,
  size = 56,
  ring = false,
}: {
  emoji: string;
  accent: string;
  size?: number;
  ring?: boolean;
}) {
  const a = accentById(accent);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Radius.pill,
        backgroundColor: a.soft,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: ring ? 3 : 0,
        borderColor: a.color,
      }}
    >
      <Text style={{ fontSize: size * 0.52 }}>{emoji}</Text>
    </View>
  );
}

// --------------------------------------------------------------------------- //
export function PointsPill({ points, accent }: { points: number; accent: string }) {
  const a = accentById(accent);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: a.soft,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: Radius.pill,
      }}
    >
      <Text style={{ fontSize: FontSize.base }}>⭐</Text>
      <Text style={{ color: a.color, fontFamily: Fonts.displayBold, fontSize: FontSize.base }}>
        {points}
      </Text>
    </View>
  );
}

// --------------------------------------------------------------------------- //
export function EmptyState({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.empty} testID="empty-state">
      <Text style={{ fontSize: 56 }}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  const styles = useStyles();
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...StyleSheet.flatten(softShadow),
  },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: Spacing.xxxl, gap: Spacing.sm },
  emptyTitle: {
    color: colors.onSurface,
    fontFamily: Fonts.displayBold,
    fontSize: FontSize.xl,
    textAlign: "center",
  },
  emptySub: { color: colors.muted, fontFamily: Fonts.body, fontSize: FontSize.base, textAlign: "center" },
  sectionTitle: { color: colors.onSurface, fontFamily: Fonts.displayBold, fontSize: FontSize.xl },
}));

export { softShadow };

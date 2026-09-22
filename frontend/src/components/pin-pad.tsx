import { Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useEffect } from "react";

import { accentById, Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { haptic } from "@/src/components/ui";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export function PinPad({
  value,
  onChange,
  length = 4,
  accent = "coral",
  error = false,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  accent?: string;
  error?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const a = accentById(accent);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (error) {
      haptic("medium");
      shake.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [error, shake]);

  const dotsStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const press = (k: string) => {
    haptic("light");
    if (k === "del") onChange(value.slice(0, -1));
    else if (k !== "" && value.length < length) onChange(value + k);
  };

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.dots, dotsStyle]}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < value.length ? a.color : colors.surfaceTertiary,
                borderColor: error ? colors.error : "transparent",
              },
            ]}
          />
        ))}
      </Animated.View>

      <View style={styles.pad}>
        {KEYS.map((k, i) => (
          <Pressable
            key={i}
            testID={k ? `pin-key-${k}` : `pin-key-empty-${i}`}
            disabled={k === ""}
            onPress={() => press(k)}
            style={({ pressed }) => [
              styles.key,
              k === "" && { backgroundColor: "transparent" },
              pressed && k !== "" && { transform: [{ scale: 0.94 }], backgroundColor: a.soft },
            ]}
          >
            <Text style={styles.keyText}>{k === "del" ? "⌫" : k}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { alignItems: "center", gap: Spacing.xl },
  dots: { flexDirection: "row", gap: Spacing.md },
  dot: { width: 18, height: 18, borderRadius: Radius.pill, borderWidth: 2 },
  pad: { width: 300, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: Spacing.md },
  key: {
    width: 88,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontFamily: Fonts.displayBold, fontSize: FontSize.xxl, color: colors.onSurface },
}));

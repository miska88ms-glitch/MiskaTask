import { Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Check } from "phosphor-react-native";

import { accentById, Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { getIcon } from "@/src/icons";
import { haptic } from "@/src/components/ui";
import type { Activity, Member } from "@/src/api";

export function ActivityCard({
  activity,
  assignee,
  canComplete,
  onToggle,
  showAssignee = false,
}: {
  activity: Activity;
  assignee?: Member;
  canComplete: boolean;
  onToggle: () => void;
  showAssignee?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const Icon = getIcon(activity.icon);
  const done = activity.status === "done";
  const a = accentById(assignee?.accent_color ?? "coral");
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const toggle = () => {
    if (!canComplete) return;
    haptic(done ? "light" : "success");
    scale.value = withSequence(withSpring(1.12, { damping: 6 }), withSpring(1, { damping: 8 }));
    onToggle();
  };

  return (
    <Animated.View style={animStyle}>
      <Pressable
        testID={`activity-card-${activity.id}`}
        onPress={() => router.push(`/task/${activity.id}`)}
        style={[styles.card, done && styles.cardDone]}
      >
        <View style={[styles.iconWrap, { backgroundColor: done ? colors.surfaceTertiary : a.soft }]}>
          <Icon size={26} color={done ? colors.muted : a.color} weight="fill" />
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, done && styles.titleDone]} numberOfLines={1}>
            {activity.title}
          </Text>
          <View style={styles.meta}>
            {activity.type === "compito" && activity.points > 0 ? (
              <Text style={styles.metaText}>⭐ {activity.points} punti</Text>
            ) : (
              <Text style={styles.metaText}>📌 Impegno</Text>
            )}
            {activity.time ? <Text style={styles.metaText}>· {activity.time}</Text> : null}
            {showAssignee && assignee ? (
              <Text style={styles.metaText}>
                · {assignee.avatar} {assignee.name}
              </Text>
            ) : null}
            {activity.has_note ? <Text style={styles.metaBadge}>📝 nota</Text> : null}
            {activity.comment_count > 0 ? <Text style={styles.metaBadge}>💬 {activity.comment_count}</Text> : null}
          </View>
        </View>

        <Pressable
          testID={`toggle-${activity.id}`}
          onPress={toggle}
          disabled={!canComplete}
          hitSlop={8}
          style={[
            styles.check,
            { borderColor: done ? a.color : colors.border, backgroundColor: done ? a.color : "transparent", opacity: canComplete ? 1 : 0.4 },
          ]}
        >
          {done ? <Check size={20} color={a.on} weight="bold" /> : null}
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    shadowColor: "#8A7A6E",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardDone: { opacity: 0.7 },
  iconWrap: { width: 52, height: 52, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 3 },
  title: { fontFamily: Fonts.displayBold, fontSize: FontSize.lg, color: colors.onSurface },
  titleDone: { textDecorationLine: "line-through", color: colors.muted },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 4, alignItems: "center" },
  metaText: { fontFamily: Fonts.bodySemibold, fontSize: FontSize.sm, color: colors.muted },
  metaBadge: { fontFamily: Fonts.bodyBold, fontSize: FontSize.sm, color: colors.onSurfaceTertiary, backgroundColor: colors.surfaceTertiary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.pill, overflow: "hidden" },
  check: { width: 34, height: 34, borderRadius: Radius.pill, borderWidth: 2, alignItems: "center", justifyContent: "center" },
}));

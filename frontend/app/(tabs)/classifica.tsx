import { RefreshControl, ScrollView, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Gift } from "phosphor-react-native";

import { accentById, Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { Avatar } from "@/src/components/ui";
import { api, type Member } from "@/src/api";
import { useApp } from "@/src/app-context";
import { usesNativeTabs } from "@/src/navigation";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Classifica() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeMember } = useApp();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const query = useQuery({ queryKey: ["leaderboard"], queryFn: api.leaderboard });
  const router = useRouter();
  const members = query.data ?? [];
  const top3 = members.slice(0, 3);
  const rest = members.slice(3);
  // Podium display order: 2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as Member[];
  const podiumHeights: Record<string, number> = top3[0] ? { [top3[0].member_id]: 120 } : {};
  if (top3[1]) podiumHeights[top3[1].member_id] = 92;
  if (top3[2]) podiumHeights[top3[2].member_id] = 74;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Classifica</Text>
            <Text style={styles.sub}>Chi guadagna più punti in famiglia?</Text>
          </View>
          <Pressable testID="open-rewards-btn" onPress={() => router.push("/rewards")} style={[styles.rewardsBtn, { backgroundColor: colors.brandTertiary }]}>
            <Gift size={20} color={colors.brandPrimary} weight="fill" />
            <Text style={[styles.rewardsBtnText, { color: colors.brandPrimary }]}>Premi</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.xl, paddingBottom: bottomChrome + Spacing.xxl, gap: Spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} tintColor={colors.brandPrimary} />}
      >
        {/* Podium */}
        <View style={styles.podium}>
          {podiumOrder.map((m) => {
            const rank = members.findIndex((x) => x.member_id === m.member_id);
            const a = accentById(m.accent_color);
            return (
              <View key={m.member_id} style={styles.podiumCol} testID={`podium-${m.member_id}`}>
                <Text style={styles.medal}>{MEDALS[rank]}</Text>
                <Avatar emoji={m.avatar} accent={m.accent_color} size={rank === 0 ? 76 : 60} ring />
                <Text style={styles.podiumName} numberOfLines={1}>{m.name}</Text>
                <View style={[styles.podiumBlock, { height: podiumHeights[m.member_id], backgroundColor: a.color }]}>
                  <Text style={[styles.podiumPoints, { color: a.on }]}>{m.points}</Text>
                  <Text style={[styles.podiumPointsLabel, { color: a.on }]}>punti</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Rest */}
        {rest.length > 0 ? (
          <View style={{ gap: Spacing.md }}>
            {rest.map((m, i) => {
              const a = accentById(m.accent_color);
              const mine = m.member_id === activeMember?.member_id;
              return (
                <Animated.View key={m.member_id} entering={FadeInDown.delay(i * 40)}>
                  <View style={[styles.row, mine && { borderColor: a.color, borderWidth: 2 }]} testID={`rank-${m.member_id}`}>
                    <Text style={styles.rankNum}>{i + 4}</Text>
                    <Avatar emoji={m.avatar} accent={m.accent_color} size={46} />
                    <Text style={styles.rowName}>{m.name}</Text>
                    <View style={[styles.pointsBadge, { backgroundColor: a.soft }]}>
                      <Text style={[styles.pointsBadgeText, { color: a.color }]}>⭐ {m.points}</Text>
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  rewardsBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.pill },
  rewardsBtnText: { fontFamily: Fonts.displayBold, fontSize: FontSize.base },
  title: { fontFamily: Fonts.displayBold, fontSize: FontSize.huge, color: colors.onSurface },
  sub: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.muted, marginTop: 2 },
  podium: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: Spacing.md, marginTop: Spacing.md },
  podiumCol: { flex: 1, alignItems: "center", gap: Spacing.xs },
  medal: { fontSize: 26 },
  podiumName: { fontFamily: Fonts.displayBold, fontSize: FontSize.base, color: colors.onSurface, maxWidth: 90 },
  podiumBlock: {
    width: "100%",
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  podiumPoints: { fontFamily: Fonts.displayBold, fontSize: FontSize.xxl },
  podiumPointsLabel: { fontFamily: Fonts.bodySemibold, fontSize: FontSize.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderColor: "transparent",
  },
  rankNum: { fontFamily: Fonts.displayBold, fontSize: FontSize.lg, color: colors.muted, width: 24, textAlign: "center" },
  rowName: { flex: 1, fontFamily: Fonts.displayBold, fontSize: FontSize.lg, color: colors.onSurface },
  pointsBadge: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill },
  pointsBadgeText: { fontFamily: Fonts.displayBold, fontSize: FontSize.base },
}));

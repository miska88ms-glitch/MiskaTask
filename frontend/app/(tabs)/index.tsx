import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Plus } from "phosphor-react-native";

import { accentById, Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { Avatar, EmptyState, PointsPill } from "@/src/components/ui";
import { ActivityCard } from "@/src/components/activity-card";
import { ActivitySheet } from "@/src/components/activity-sheet";
import { api, type Activity } from "@/src/api";
import { useApp } from "@/src/app-context";
import { todayStr } from "@/src/date";
import { usesNativeTabs } from "@/src/navigation";

export default function Oggi() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { members, activeMember } = useApp();
  const queryClient = useQueryClient();
  const today = todayStr();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const isCapo = activeMember?.role === "capo";
  const accent = accentById(activeMember?.accent_color);

  const [filter, setFilter] = useState<string>(isCapo ? "all" : activeMember?.member_id ?? "all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  const activitiesQuery = useQuery({
    queryKey: ["activities", today],
    queryFn: () => api.activities(today, today),
  });

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.member_id, m])), [members]);

  const toggleMutation = useMutation({
    mutationFn: (a: Activity) => (a.status === "done" ? api.uncompleteActivity(a.id) : api.completeActivity(a.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["family"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });

  const all = activitiesQuery.data ?? [];
  const filtered = filter === "all" ? all : all.filter((a) => a.assigned_to === filter);
  const todo = filtered.filter((a) => a.status === "todo");
  const done = filtered.filter((a) => a.status === "done");

  const canComplete = (a: Activity) => isCapo || a.assigned_to === activeMember?.member_id;

  return (
    <View style={styles.root}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Ciao {activeMember?.name} 👋</Text>
            <Text style={styles.sub}>Ecco i compiti di oggi</Text>
          </View>
          <PointsPill points={activeMember?.points ?? 0} accent={accent.id} />
        </View>

        {isCapo ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={styles.chipScroll}
          >
            <FilterChip label="Tutti" emoji="👨‍👩‍👧" active={filter === "all"} accent={accent.id} onPress={() => setFilter("all")} testID="filter-all" />
            {members.map((m) => (
              <FilterChip
                key={m.member_id}
                label={m.name}
                emoji={m.avatar}
                active={filter === m.member_id}
                accent={m.accent_color}
                onPress={() => setFilter(m.member_id)}
                testID={`filter-${m.member_id}`}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.xl, paddingBottom: bottomChrome + 120, gap: Spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={activitiesQuery.isFetching} onRefresh={() => activitiesQuery.refetch()} tintColor={accent.color} />
        }
      >
        {todo.length === 0 && done.length === 0 ? (
          <EmptyState emoji="🌟" title="Nessun compito per oggi!" subtitle="Riposati oppure aggiungine uno con il pulsante +." />
        ) : (
          <>
            {todo.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Da fare ({todo.length})</Text>
                {todo.map((a, i) => (
                  <Animated.View key={a.id} entering={FadeInDown.delay(i * 40)}>
                    <ActivityCard
                      activity={a}
                      assignee={memberById[a.assigned_to]}
                      canComplete={canComplete(a)}
                      showAssignee={filter === "all"}
                      onToggle={() => toggleMutation.mutate(a)}
                    />
                  </Animated.View>
                ))}
              </View>
            ) : null}

            {done.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Fatti ({done.length})</Text>
                {done.map((a) => (
                  <ActivityCard
                    key={a.id}
                    activity={a}
                    assignee={memberById[a.assigned_to]}
                    canComplete={canComplete(a)}
                    showAssignee={filter === "all"}
                    onToggle={() => toggleMutation.mutate(a)}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Pressable
        testID="add-activity-fab"
        onPress={() => {
          setEditing(null);
          setSheetOpen(true);
        }}
        style={[styles.fab, { backgroundColor: accent.color, bottom: bottomChrome + 16 }]}
      >
        <Plus size={30} color={accent.on} weight="bold" />
      </Pressable>

      <ActivitySheet visible={sheetOpen} onClose={() => setSheetOpen(false)} date={today} editing={editing} />
    </View>
  );
}

function FilterChip({
  label,
  emoji,
  active,
  accent,
  onPress,
  testID,
}: {
  label: string;
  emoji: string;
  active: boolean;
  accent: string;
  onPress: () => void;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const a = accentById(accent);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? a.color : colors.surfaceSecondary, borderColor: active ? a.color : colors.border }]}
    >
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      <Text style={[styles.chipText, { color: active ? a.on : colors.onSurface }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { backgroundColor: colors.surface, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTop: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  hello: { fontFamily: Fonts.displayBold, fontSize: FontSize.xxl, color: colors.onSurface },
  sub: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.muted, marginTop: 2 },
  chipScroll: { marginTop: Spacing.md, marginHorizontal: -Spacing.xl },
  chipRow: { gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: 4 },
  chip: {
    height: 40,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    maxWidth: 140,
  },
  chipText: { fontFamily: Fonts.bodyBold, fontSize: FontSize.base },
  section: { gap: Spacing.md },
  sectionTitle: { fontFamily: Fonts.displayBold, fontSize: FontSize.xl, color: colors.onSurface },
  fab: {
    position: "absolute",
    right: Spacing.xl,
    width: 62,
    height: 62,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
}));

import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "phosphor-react-native";

import { accentById, Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { Avatar, EmptyState } from "@/src/components/ui";
import { ActivityCard } from "@/src/components/activity-card";
import { ActivitySheet } from "@/src/components/activity-sheet";
import { api, type Activity } from "@/src/api";
import { useApp } from "@/src/app-context";
import { dayRange, longDate, todayStr } from "@/src/date";
import { usesNativeTabs } from "@/src/navigation";

export default function Calendario() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { members, activeMember } = useApp();
  const queryClient = useQueryClient();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const isCapo = activeMember?.role === "capo";
  const accent = accentById(activeMember?.accent_color);

  const days = useMemo(() => dayRange(3, 24), []);
  const rangeStart = days[0].key;
  const rangeEnd = days[days.length - 1].key;

  const [selected, setSelected] = useState<string>(todayStr());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  const activitiesQuery = useQuery({
    queryKey: ["activities", "range", rangeStart, rangeEnd],
    queryFn: () => api.activities(rangeStart, rangeEnd),
  });

  const all = activitiesQuery.data ?? [];
  const daysWithItems = useMemo(() => new Set(all.map((a) => a.date)), [all]);
  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.member_id, m])), [members]);

  const forDay = all.filter((a) => a.date === selected);
  const grouped = useMemo(() => {
    const map: Record<string, Activity[]> = {};
    forDay.forEach((a) => {
      (map[a.assigned_to] ||= []).push(a);
    });
    return members.filter((m) => map[m.member_id]?.length).map((m) => ({ member: m, items: map[m.member_id] }));
  }, [forDay, members]);

  const toggleMutation = useMutation({
    mutationFn: (a: Activity) => (a.status === "done" ? api.uncompleteActivity(a.id) : api.completeActivity(a.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["family"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });

  const canComplete = (a: Activity) => isCapo || a.assigned_to === activeMember?.member_id;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.title}>Calendario</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow} style={styles.dateScroll}>
          {days.map(({ key, d }) => {
            const active = selected === key;
            const hasItems = daysWithItems.has(key);
            return (
              <Pressable
                key={key}
                testID={`day-${key}`}
                onPress={() => setSelected(key)}
                style={[styles.dateCell, { backgroundColor: active ? accent.color : colors.surfaceSecondary, borderColor: active ? accent.color : colors.border }]}
              >
                <Text style={[styles.dateWeekday, { color: active ? accent.on : colors.muted }]}>
                  {d.format("dd").toUpperCase()}
                </Text>
                <Text style={[styles.dateNum, { color: active ? accent.on : colors.onSurface }]}>{d.format("D")}</Text>
                <View style={[styles.dot, { backgroundColor: hasItems ? (active ? accent.on : accent.color) : "transparent" }]} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.xl, paddingBottom: bottomChrome + 120, gap: Spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={activitiesQuery.isFetching} onRefresh={() => activitiesQuery.refetch()} tintColor={accent.color} />}
      >
        <Text style={styles.dayLabel}>{longDate(selected)}</Text>

        {grouped.length === 0 ? (
          <EmptyState emoji="📅" title="Nessun impegno in vista." subtitle="Tocca + per aggiungere un compito o un impegno." />
        ) : (
          grouped.map(({ member, items }) => (
            <View key={member.member_id} style={styles.group}>
              <View style={styles.groupHeader}>
                <Avatar emoji={member.avatar} accent={member.accent_color} size={40} />
                <Text style={styles.groupName}>{member.name}</Text>
                {member.role === "capo" ? <Text style={styles.capoTag}>👑</Text> : null}
              </View>
              <View style={{ gap: Spacing.md }}>
                {items.map((a) => (
                  <ActivityCard
                    key={a.id}
                    activity={a}
                    assignee={member}
                    canComplete={canComplete(a)}
                    onToggle={() => toggleMutation.mutate(a)}
                  />
                ))}
              </View>
            </View>
          ))
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

      <ActivitySheet visible={sheetOpen} onClose={() => setSheetOpen(false)} date={selected} editing={editing} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { backgroundColor: colors.surface, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontFamily: Fonts.displayBold, fontSize: FontSize.huge, color: colors.onSurface, paddingHorizontal: Spacing.xl },
  dateScroll: { marginTop: Spacing.md },
  dateRow: { gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  dateCell: { flexShrink: 0, width: 56, height: 74, borderRadius: Radius.md, alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1.5 },
  dateWeekday: { fontFamily: Fonts.bodyBold, fontSize: FontSize.sm },
  dateNum: { fontFamily: Fonts.displayBold, fontSize: FontSize.xl },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dayLabel: { fontFamily: Fonts.displayBold, fontSize: FontSize.xl, color: colors.onSurface, textTransform: "capitalize" },
  group: { gap: Spacing.md },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  groupName: { fontFamily: Fonts.displayBold, fontSize: FontSize.lg, color: colors.onSurface },
  capoTag: { fontSize: 16 },
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

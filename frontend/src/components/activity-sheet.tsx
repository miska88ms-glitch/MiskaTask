import { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "phosphor-react-native";

import {
  accentById,
  Fonts,
  FontSize,
  makeStyles,
  Radius,
  Spacing,
  useTheme,
} from "@/src/theme";
import { Btn, haptic } from "@/src/components/ui";
import { getIcon, CHORE_ICONS, COMMITMENT_ICONS } from "@/src/icons";
import { api, type Activity } from "@/src/api";
import { useApp } from "@/src/app-context";
import { useToast } from "@/src/components/toast";
import { dayjs } from "@/src/date";

const POINT_OPTIONS = [5, 10, 15, 20, 25];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const FormScrollView = Platform.OS === "web" ? ScrollView : KeyboardAwareScrollView;

export function ActivitySheet({
  visible,
  onClose,
  date,
  editing,
}: {
  visible: boolean;
  onClose: () => void;
  date: string;
  editing?: Activity | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { members, activeMember } = useApp();
  const queryClient = useQueryClient();
  const toast = useToast();

  const isCapo = activeMember?.role === "capo";
  const presetsQuery = useQuery({ queryKey: ["presets"], queryFn: api.presets, enabled: visible && isCapo });

  const [type, setType] = useState<"compito" | "impegno">("compito");
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("star");
  const [points, setPoints] = useState(10);
  const [assignedTo, setAssignedTo] = useState<string>(activeMember?.member_id ?? "");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [weeks, setWeeks] = useState(4);

  const accent = accentById(activeMember?.accent_color).id;

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setType(editing.type);
      setTitle(editing.title);
      setIcon(editing.icon);
      setPoints(editing.points || 10);
      setAssignedTo(editing.assigned_to);
      setTime(editing.time ?? "");
      setEndTime(editing.end_time ?? "");
      setRepeat(false);
      setWeekdays([]);
      setWeeks(4);
    } else {
      setType(isCapo ? "compito" : "impegno");
      setTitle("");
      setIcon(isCapo ? "broom" : "star");
      setPoints(10);
      setAssignedTo(activeMember?.member_id ?? members[0]?.member_id ?? "");
      setTime("");
      setEndTime("");
      setRepeat(false);
      setWeekdays([]);
      setWeeks(4);
    }
  }, [visible, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const iconOptions = type === "compito" ? CHORE_ICONS : COMMITMENT_ICONS;

  const toggleRepeat = () => {
    haptic("selection");
    if (!repeat) {
      const base = dayjs(date);
      setWeekdays([(base.day() + 6) % 7]); // Mon-based weekday of the base date
    } else {
      setWeekdays([]);
    }
    setRepeat(!repeat);
  };

  const toggleWeekday = (wd: number) => {
    setWeekdays((cur) => (cur.includes(wd) ? cur.filter((x) => x !== wd) : [...cur, wd]));
  };

  const computeDates = (): string[] => {
    const base = dayjs(date);
    const set = new Set<string>();
    for (let w = 0; w < weeks; w++) {
      for (const wd of weekdays) {
        const d = base.startOf("week").add(wd, "day").add(w, "week");
        if (d.isBefore(base, "day")) continue;
        set.add(d.format("YYYY-MM-DD"));
      }
    }
    if (set.size === 0) set.add(date);
    return Array.from(set).sort();
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const useRecurrence = !editing && repeat && weekdays.length > 0;
      const dates = useRecurrence ? computeDates() : undefined;
      const body = {
        type,
        title: title.trim(),
        icon,
        points: type === "compito" ? points : 0,
        assigned_to: assignedTo,
        date: dates ? dates[0] : date,
        time: time.trim() || null,
        end_time: endTime.trim() || null,
        dates,
      };
      if (editing) return api.updateActivity(editing.id, body);
      return api.createActivity(body);
    },
    onSuccess: () => {
      haptic("success");
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["family"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      toast(editing ? "Attività aggiornata" : "Aggiunta! 🎉", "success");
      onClose();
    },
    onError: (e: Error) => toast(e.message || "Errore", "error"),
  });

  const canSave = title.trim().length > 0 && assignedTo.length > 0;

  const assignableMembers = useMemo(() => (isCapo ? members : members.filter((m) => m.member_id === activeMember?.member_id)), [isCapo, members, activeMember]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} testID="sheet-backdrop" />
        <View testID="activity-sheet-panel" style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {editing ? "Modifica" : type === "compito" ? "Nuovo compito" : "Nuovo impegno"}
            </Text>
            <Pressable testID="close-sheet" onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={20} color={colors.onSurface} weight="bold" />
            </Pressable>
          </View>

          <FormScrollView
            testID="activity-sheet-scroll"
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ gap: Spacing.lg, paddingBottom: Spacing.lg }}
            bottomOffset={20}
            showsVerticalScrollIndicator={false}
          >
            {isCapo && !editing ? (
              <View style={styles.segment}>
                {(["compito", "impegno"] as const).map((t) => (
                  <Pressable
                    key={t}
                    testID={`type-${t}`}
                    onPress={() => setType(t)}
                    style={[styles.segmentBtn, type === t && { backgroundColor: accentById(accent).color }]}
                  >
                    <Text style={[styles.segmentText, type === t && { color: accentById(accent).on }]}>
                      {t === "compito" ? "Compito" : "Impegno"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {type === "compito" && isCapo && presetsQuery.data ? (
              <View style={styles.presetWrap}>
                <Text style={styles.label}>Preimpostati</Text>
                <View style={styles.presetRow}>
                  {presetsQuery.data.map((p) => (
                    <Pressable
                      key={p.title}
                      testID={`preset-${p.icon}`}
                      onPress={() => {
                        setTitle(p.title);
                        setIcon(p.icon);
                        setPoints(p.points);
                        haptic("selection");
                      }}
                      style={styles.presetChip}
                    >
                      <Text style={styles.presetChipText}>{p.title}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Titolo</Text>
              <TextInput
                testID="input-activity-title"
                value={title}
                onChangeText={setTitle}
                placeholder={type === "compito" ? "Es. Studia matematica" : "Es. Allenamento calcio"}
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Icona</Text>
              <View style={styles.iconGrid}>
                {iconOptions.map((ic) => {
                  const Icon = getIcon(ic);
                  const sel = icon === ic;
                  return (
                    <Pressable
                      key={ic}
                      testID={`icon-${ic}`}
                      onPress={() => setIcon(ic)}
                      style={[styles.iconCell, { backgroundColor: sel ? accentById(accent).soft : colors.surfaceTertiary, borderColor: sel ? accentById(accent).color : "transparent" }]}
                    >
                      <Icon size={24} color={sel ? accentById(accent).color : colors.onSurfaceTertiary} weight="fill" />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {type === "compito" ? (
              <View style={styles.field}>
                <Text style={styles.label}>Punti</Text>
                <View style={styles.pointRow}>
                  {POINT_OPTIONS.map((p) => (
                    <Pressable
                      key={p}
                      testID={`points-${p}`}
                      onPress={() => setPoints(p)}
                      style={[styles.pointChip, points === p && { backgroundColor: accentById(accent).color }]}
                    >
                      <Text style={[styles.pointText, points === p && { color: accentById(accent).on }]}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>{type === "compito" ? "Assegna a" : "Per"}</Text>
              <View style={styles.memberRow}>
                {assignableMembers.map((m) => {
                  const sel = assignedTo === m.member_id;
                  return (
                    <Pressable
                      key={m.member_id}
                      testID={`assign-${m.member_id}`}
                      onPress={() => setAssignedTo(m.member_id)}
                      style={[styles.memberChip, { backgroundColor: sel ? accentById(m.accent_color).soft : colors.surfaceTertiary, borderColor: sel ? accentById(m.accent_color).color : "transparent" }]}
                    >
                      <Text style={{ fontSize: 20 }}>{m.avatar}</Text>
                      <Text style={styles.memberChipText}>{m.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.timeRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>{type === "impegno" ? "Dalle" : "Orario"} (facolt.)</Text>
                <TextInput
                  testID="input-time"
                  value={time}
                  onChangeText={setTime}
                  placeholder="Es. 19:00"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Alle (facolt.)</Text>
                <TextInput
                  testID="input-end-time"
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="Es. 20:00"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </View>
            </View>

            {!editing ? (
              <View style={styles.field}>
                <Pressable testID="repeat-toggle" onPress={toggleRepeat} style={styles.repeatRow}>
                  <Text style={styles.label}>🔁 Ripeti ogni settimana</Text>
                  <View style={[styles.switch, { backgroundColor: repeat ? accentById(accent).color : colors.surfaceTertiary }]}>
                    <View style={[styles.knob, { alignSelf: repeat ? "flex-end" : "flex-start" }]} />
                  </View>
                </Pressable>

                {repeat ? (
                  <View style={{ gap: Spacing.md }}>
                    <View style={styles.weekRow}>
                      {WEEKDAYS.map((lbl, i) => {
                        const sel = weekdays.includes(i);
                        return (
                          <Pressable
                            key={lbl}
                            testID={`weekday-${i}`}
                            onPress={() => toggleWeekday(i)}
                            style={[styles.weekChip, { backgroundColor: sel ? accentById(accent).color : colors.surfaceTertiary }]}
                          >
                            <Text style={[styles.weekChipText, { color: sel ? accentById(accent).on : colors.onSurfaceTertiary }]}>{lbl}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <View style={styles.weeksRow}>
                      <Text style={styles.label}>Per</Text>
                      <Pressable testID="weeks-minus" onPress={() => setWeeks((w) => Math.max(1, w - 1))} style={styles.stepBtn}>
                        <Text style={styles.stepText}>−</Text>
                      </Pressable>
                      <Text style={styles.weeksNum}>{weeks}</Text>
                      <Pressable testID="weeks-plus" onPress={() => setWeeks((w) => Math.min(12, w + 1))} style={styles.stepBtn}>
                        <Text style={styles.stepText}>+</Text>
                      </Pressable>
                      <Text style={styles.label}>settimane</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

          </FormScrollView>
          <View style={styles.footer}>
            <Btn
              label={editing ? "Salva" : "Aggiungi"}
              testID="save-activity-btn"
              accent={accent}
              loading={mutation.isPending}
              disabled={!canSave}
              onPress={() => mutation.mutate()}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  backdropTap: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    height: "90%",
    maxHeight: "90%",
  },
  scroll: { flex: 1, minHeight: 0 },
  footer: { paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: Radius.pill, backgroundColor: colors.border, marginBottom: Spacing.md },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.lg },
  sheetTitle: { fontFamily: Fonts.displayBold, fontSize: FontSize.xxl, color: colors.onSurface },
  closeBtn: { width: 44, height: 44, borderRadius: Radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: Radius.pill, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.pill, alignItems: "center" },
  segmentText: { fontFamily: Fonts.displayBold, fontSize: FontSize.base, color: colors.onSurfaceTertiary },
  presetWrap: { gap: Spacing.sm },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  presetChip: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.pill },
  presetChipText: { fontFamily: Fonts.bodySemibold, fontSize: FontSize.sm, color: colors.onSurfaceTertiary },
  field: { gap: Spacing.sm },
  timeRow: { flexDirection: "row", gap: Spacing.md },
  label: { fontFamily: Fonts.bodyBold, fontSize: FontSize.base, color: colors.onSurface },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontFamily: Fonts.bodySemibold,
    fontSize: FontSize.lg,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  iconCell: { width: 52, height: 52, borderRadius: Radius.md, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  pointRow: { flexDirection: "row", gap: Spacing.sm },
  pointChip: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center" },
  pointText: { fontFamily: Fonts.displayBold, fontSize: FontSize.lg, color: colors.onSurfaceTertiary },
  memberRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  memberChip: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.pill, borderWidth: 2 },
  memberChipText: { fontFamily: Fonts.bodyBold, fontSize: FontSize.base, color: colors.onSurface },
  repeatRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switch: { width: 48, height: 28, borderRadius: Radius.pill, padding: 3, justifyContent: "center" },
  knob: { width: 22, height: 22, borderRadius: Radius.pill, backgroundColor: "#FFFFFF" },
  weekRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  weekChip: { flex: 1, minWidth: 42, paddingVertical: 10, borderRadius: Radius.md, alignItems: "center" },
  weekChipText: { fontFamily: Fonts.bodyBold, fontSize: FontSize.sm },
  weeksRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  stepBtn: { width: 40, height: 40, borderRadius: Radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  stepText: { fontFamily: Fonts.displayBold, fontSize: FontSize.xl, color: colors.onSurface },
  weeksNum: { fontFamily: Fonts.displayBold, fontSize: FontSize.xl, color: colors.onSurface, minWidth: 24, textAlign: "center" },
}));

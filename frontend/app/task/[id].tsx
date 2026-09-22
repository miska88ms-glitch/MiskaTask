import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, NotePencil, PaperPlaneRight, PencilSimple, Trash } from "phosphor-react-native";

import { accentById, Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { IconBubble, haptic } from "@/src/components/ui";
import { ActivitySheet } from "@/src/components/activity-sheet";
import { api, type Activity } from "@/src/api";
import { useApp } from "@/src/app-context";
import { useToast } from "@/src/components/toast";
import { longDate, dayjs } from "@/src/date";

export default function TaskDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { members, activeMember } = useApp();
  const queryClient = useQueryClient();
  const toast = useToast();
  const scrollRef = useRef<ScrollView>(null);

  const activityQuery = useQuery({ queryKey: ["activity", id], queryFn: () => api.activity(id) });
  const commentsQuery = useQuery({
    queryKey: ["comments", id],
    queryFn: () => api.comments(id),
    refetchInterval: 8000,
  });

  const activity = activityQuery.data;
  const isCapo = activeMember?.role === "capo";
  const assignee = members.find((m) => m.member_id === activity?.assigned_to);
  const accent = accentById(assignee?.accent_color ?? activeMember?.accent_color);

  const canComplete = !!activity && (isCapo || activity.assigned_to === activeMember?.member_id);
  const canEdit = !!activity && (isCapo || activity.created_by === activeMember?.member_id);

  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [message, setMessage] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (activity && !editingNote) setNoteDraft(activity.note ?? "");
  }, [activity, editingNote]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["activity", id] });
    queryClient.invalidateQueries({ queryKey: ["activities"] });
    queryClient.invalidateQueries({ queryKey: ["family"] });
    queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
  };

  const toggleMutation = useMutation({
    mutationFn: () => (activity!.status === "done" ? api.uncompleteActivity(id) : api.completeActivity(id)),
    onSuccess: () => {
      haptic("success");
      invalidateAll();
    },
  });

  const noteMutation = useMutation({
    mutationFn: () => api.updateActivity(id, { note: noteDraft.trim() }),
    onSuccess: () => {
      setEditingNote(false);
      invalidateAll();
      toast("Nota salvata", "success");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteActivity(id),
    onSuccess: () => {
      invalidateAll();
      toast("Eliminata", "success");
      router.back();
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => api.addComment(id, text),
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const comments = commentsQuery.data ?? [];

  if (!activity) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable testID="task-back-btn" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
            <ArrowLeft size={24} color={colors.onSurface} weight="bold" />
          </Pressable>
          <Text style={styles.headerTitle}>Dettaglio</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.loading}>Caricamento…</Text>
      </View>
    );
  }

  const done = activity.status === "done";

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable testID="task-back-btn" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Dettaglio</Text>
        <View style={styles.headerActions}>
          {canEdit ? (
            <Pressable testID="task-edit-btn" onPress={() => setSheetOpen(true)} hitSlop={8} style={styles.iconBtn}>
              <PencilSimple size={20} color={colors.onSurface} weight="bold" />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary */}
          <View style={styles.summary}>
            <IconBubble icon={activity.icon} color={accent.id} bubble={64} size={30} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.title, done && styles.strike]}>{activity.title}</Text>
              <Text style={styles.meta}>
                {activity.type === "compito" && activity.points > 0 ? `⭐ ${activity.points} punti · ` : "📌 Impegno · "}
                {assignee ? `${assignee.avatar} ${assignee.name}` : ""}
              </Text>
              <Text style={styles.meta}>
                📅 {longDate(activity.date)}
                {activity.time ? ` · ${activity.time}` : ""}
              </Text>
            </View>
          </View>

          {canComplete ? (
            <Pressable
              testID="task-complete-btn"
              onPress={() => toggleMutation.mutate()}
              style={[styles.completeBtn, { backgroundColor: done ? colors.surfaceTertiary : accent.color }]}
            >
              <Check size={20} color={done ? colors.onSurfaceTertiary : accent.on} weight="bold" />
              <Text style={[styles.completeText, { color: done ? colors.onSurfaceTertiary : accent.on }]}>
                {done ? "Segna da fare" : "Segna come completato"}
              </Text>
            </Pressable>
          ) : null}

          {/* Note */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Nota</Text>
              {canEdit && !editingNote ? (
                <Pressable testID="edit-note-btn" onPress={() => setEditingNote(true)} hitSlop={8} style={styles.noteEdit}>
                  <NotePencil size={16} color={accent.color} weight="bold" />
                  <Text style={[styles.noteEditText, { color: accent.color }]}>{activity.note ? "Modifica" : "Aggiungi"}</Text>
                </Pressable>
              ) : null}
            </View>
            {editingNote ? (
              <View style={{ gap: Spacing.sm }}>
                <TextInput
                  testID="note-input"
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  placeholder="Scrivi una nota per questo compito…"
                  placeholderTextColor={colors.muted}
                  multiline
                  style={styles.noteInput}
                />
                <View style={styles.noteActions}>
                  <Pressable testID="note-cancel" onPress={() => { setEditingNote(false); setNoteDraft(activity.note ?? ""); }} style={[styles.smallBtn, { backgroundColor: colors.surfaceTertiary }]}>
                    <Text style={styles.smallBtnText}>Annulla</Text>
                  </Pressable>
                  <Pressable testID="note-save" onPress={() => noteMutation.mutate()} style={[styles.smallBtn, { backgroundColor: accent.color }]}>
                    <Text style={[styles.smallBtnText, { color: accent.on }]}>Salva</Text>
                  </Pressable>
                </View>
              </View>
            ) : activity.note ? (
              <View style={[styles.noteCard, { borderLeftColor: accent.color }]}>
                <Text style={styles.noteText}>{activity.note}</Text>
              </View>
            ) : (
              <Text style={styles.noteEmpty}>Nessuna nota.</Text>
            )}
          </View>

          {/* Chat */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chat ({comments.length})</Text>
            {comments.length === 0 ? (
              <Text style={styles.noteEmpty}>Ancora nessun messaggio. Scrivi qualcosa!</Text>
            ) : (
              <View style={{ gap: Spacing.sm }}>
                {comments.map((c) => {
                  const mine = c.member_id === activeMember?.member_id;
                  const ca = accentById(c.member_accent);
                  return (
                    <View key={c.id} style={[styles.bubbleRow, mine && { justifyContent: "flex-end" }]}>
                      {!mine ? <Text style={styles.bubbleAvatar}>{c.member_avatar}</Text> : null}
                      <View style={[styles.bubble, mine ? { backgroundColor: ca.color } : { backgroundColor: colors.surfaceSecondary }]}>
                        {!mine ? <Text style={[styles.bubbleName, { color: ca.color }]}>{c.member_name}</Text> : null}
                        <Text style={[styles.bubbleText, mine && { color: ca.on }]}>{c.text}</Text>
                        <Text style={[styles.bubbleTime, mine ? { color: ca.on } : { color: colors.muted }]}>{dayjs(c.created_at).format("HH:mm")}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {canEdit ? (
            confirmDelete ? (
              <View style={styles.noteActions}>
                <Pressable testID="delete-cancel" onPress={() => setConfirmDelete(false)} style={[styles.smallBtn, { backgroundColor: colors.surfaceTertiary }]}>
                  <Text style={styles.smallBtnText}>Annulla</Text>
                </Pressable>
                <Pressable testID="delete-confirm" onPress={() => deleteMutation.mutate()} style={[styles.smallBtn, { backgroundColor: colors.error }]}>
                  <Text style={[styles.smallBtnText, { color: colors.onError }]}>Elimina davvero</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable testID="task-delete-btn" onPress={() => setConfirmDelete(true)} style={styles.deleteBtn}>
                <Trash size={18} color={colors.error} weight="bold" />
                <Text style={styles.deleteText}>Elimina attività</Text>
              </Pressable>
            )
          ) : null}
        </ScrollView>

        {/* Composer */}
        <View style={[styles.composer, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <TextInput
            testID="comment-input"
            value={message}
            onChangeText={setMessage}
            placeholder="Scrivi un messaggio…"
            placeholderTextColor={colors.muted}
            style={styles.composerInput}
            onSubmitEditing={() => message.trim() && commentMutation.mutate(message.trim())}
          />
          <Pressable
            testID="send-comment-btn"
            disabled={!message.trim() || commentMutation.isPending}
            onPress={() => message.trim() && commentMutation.mutate(message.trim())}
            style={[styles.sendBtn, { backgroundColor: accent.color, opacity: message.trim() ? 1 : 0.5 }]}
          >
            <PaperPlaneRight size={20} color={accent.on} weight="fill" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ActivitySheet visible={sheetOpen} onClose={() => setSheetOpen(false)} date={activity.date} editing={activity} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  backBtn: { width: 40, height: 40, borderRadius: Radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerActions: { flexDirection: "row" },
  iconBtn: { width: 40, height: 40, borderRadius: Radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: Fonts.displayBold, fontSize: FontSize.xl, color: colors.onSurface, flex: 1, textAlign: "center" },
  loading: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.muted, textAlign: "center", marginTop: Spacing.xxxl },
  summary: { flexDirection: "row", gap: Spacing.md, alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: Radius.lg, padding: Spacing.lg },
  title: { fontFamily: Fonts.displayBold, fontSize: FontSize.xxl, color: colors.onSurface },
  strike: { textDecorationLine: "line-through", color: colors.muted },
  meta: { fontFamily: Fonts.bodySemibold, fontSize: FontSize.sm, color: colors.muted },
  completeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, paddingVertical: 14, borderRadius: Radius.pill },
  completeText: { fontFamily: Fonts.displayBold, fontSize: FontSize.lg },
  section: { gap: Spacing.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontFamily: Fonts.displayBold, fontSize: FontSize.xl, color: colors.onSurface },
  noteEdit: { flexDirection: "row", alignItems: "center", gap: 4 },
  noteEditText: { fontFamily: Fonts.bodyBold, fontSize: FontSize.base },
  noteCard: { backgroundColor: colors.surfaceSecondary, borderRadius: Radius.md, padding: Spacing.lg, borderLeftWidth: 4 },
  noteText: { fontFamily: Fonts.bodySemibold, fontSize: FontSize.base, color: colors.onSurface, lineHeight: 22 },
  noteEmpty: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.muted },
  noteInput: { backgroundColor: colors.surfaceSecondary, borderRadius: Radius.md, padding: Spacing.lg, minHeight: 90, fontFamily: Fonts.bodySemibold, fontSize: FontSize.base, color: colors.onSurface, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border },
  noteActions: { flexDirection: "row", gap: Spacing.sm, justifyContent: "flex-end" },
  smallBtn: { paddingHorizontal: Spacing.lg, paddingVertical: 10, borderRadius: Radius.pill },
  smallBtnText: { fontFamily: Fonts.bodyBold, fontSize: FontSize.base, color: colors.onSurface },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  bubbleAvatar: { fontSize: 22 },
  bubble: { maxWidth: "78%", borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 2 },
  bubbleName: { fontFamily: Fonts.bodyBold, fontSize: FontSize.sm },
  bubbleText: { fontFamily: Fonts.bodySemibold, fontSize: FontSize.base, color: colors.onSurface },
  bubbleTime: { fontFamily: Fonts.body, fontSize: 10, alignSelf: "flex-end" },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, paddingVertical: 12 },
  deleteText: { fontFamily: Fonts.bodyBold, fontSize: FontSize.base, color: colors.error },
  composer: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  composerInput: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, paddingVertical: 12, fontFamily: Fonts.bodySemibold, fontSize: FontSize.base, color: colors.onSurface },
  sendBtn: { width: 46, height: 46, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
}));

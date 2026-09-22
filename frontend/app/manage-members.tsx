import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PencilSimple, Plus, Trash } from "phosphor-react-native";

import { accentById, Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { Avatar, Btn } from "@/src/components/ui";
import { MemberSheet } from "@/src/components/member-sheet";
import { api, type Member } from "@/src/api";
import { useApp } from "@/src/app-context";
import { useToast } from "@/src/components/toast";

export default function ManageMembers() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { members, activeMember } = useApp();
  const queryClient = useQueryClient();
  const toast = useToast();

  const accent = accentById(activeMember?.accent_color);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      toast("Membro rimosso", "success");
      setConfirmId(null);
    },
    onError: (e: Error) => {
      toast(e.message || "Errore", "error");
      setConfirmId(null);
    },
  });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable testID="mm-back-btn" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={styles.headerTitle}>Gestisci membri</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.xl, paddingBottom: insets.bottom + Spacing.xxl, gap: Spacing.md }} showsVerticalScrollIndicator={false}>
        {members.map((m) => {
          const a = accentById(m.accent_color);
          return (
            <View key={m.member_id} style={styles.row} testID={`mm-row-${m.member_id}`}>
              <Avatar emoji={m.avatar} accent={m.accent_color} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{m.name}</Text>
                <Text style={styles.meta}>
                  {m.role === "capo" ? "👑 Capo famiglia" : "Membro"} · ⭐ {m.points}
                </Text>
              </View>
              {confirmId === m.member_id ? (
                <View style={styles.confirmRow}>
                  <Pressable testID={`mm-cancel-${m.member_id}`} onPress={() => setConfirmId(null)} style={[styles.smallBtn, { backgroundColor: colors.surfaceTertiary }]}>
                    <Text style={styles.smallBtnText}>Annulla</Text>
                  </Pressable>
                  <Pressable testID={`mm-confirm-delete-${m.member_id}`} onPress={() => deleteMutation.mutate(m.member_id)} style={[styles.smallBtn, { backgroundColor: colors.error }]}>
                    <Text style={[styles.smallBtnText, { color: colors.onError }]}>Rimuovi</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.actions}>
                  <Pressable
                    testID={`mm-edit-${m.member_id}`}
                    onPress={() => {
                      setEditing(m);
                      setSheetOpen(true);
                    }}
                    style={[styles.iconBtn, { backgroundColor: a.soft }]}
                  >
                    <PencilSimple size={18} color={a.color} weight="bold" />
                  </Pressable>
                  {m.role !== "capo" ? (
                    <Pressable testID={`mm-delete-${m.member_id}`} onPress={() => setConfirmId(m.member_id)} style={[styles.iconBtn, { backgroundColor: colors.brandTertiary }]}>
                      <Trash size={18} color={colors.error} weight="bold" />
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ marginTop: Spacing.md }}>
          <Btn
            label="Aggiungi membro"
            testID="mm-add-btn"
            accent={accent.id}
            icon={<Plus size={22} color={accent.on} weight="bold" />}
            onPress={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          />
        </View>
      </ScrollView>

      <MemberSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} editing={editing} accent={accent.id} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: Radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: Fonts.displayBold, fontSize: FontSize.xl, color: colors.onSurface },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: Radius.lg, padding: Spacing.md },
  name: { fontFamily: Fonts.displayBold, fontSize: FontSize.lg, color: colors.onSurface },
  meta: { fontFamily: Fonts.bodySemibold, fontSize: FontSize.sm, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: "row", gap: Spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  confirmRow: { flexDirection: "row", gap: Spacing.sm },
  smallBtn: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.pill },
  smallBtnText: { fontFamily: Fonts.bodyBold, fontSize: FontSize.sm, color: colors.onSurface },
}));

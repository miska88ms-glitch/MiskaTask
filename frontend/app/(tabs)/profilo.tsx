import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CaretRight, PencilSimple, SignOut, UsersThree, ArrowsClockwise } from "phosphor-react-native";

import { ACCENTS, accentById, Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { Avatar } from "@/src/components/ui";
import { MemberSheet } from "@/src/components/member-sheet";
import { api } from "@/src/api";
import { useApp } from "@/src/app-context";
import { useToast } from "@/src/components/toast";
import { usesNativeTabs } from "@/src/navigation";

export default function Profilo() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, activeMember, clearActiveMember, signOut } = useApp();
  const queryClient = useQueryClient();
  const toast = useToast();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const [editOpen, setEditOpen] = useState(false);
  const accent = accentById(activeMember?.accent_color);
  const isCapo = activeMember?.role === "capo";

  const accentMutation = useMutation({
    mutationFn: (accentId: string) => api.updateMember(activeMember!.member_id, { accent_color: accentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      toast("Colore aggiornato 🎨", "success");
    },
  });

  if (!activeMember) return null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingHorizontal: Spacing.xl, paddingBottom: bottomChrome + Spacing.xxl, gap: Spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profilo</Text>

        {/* Member card */}
        <View style={[styles.hero, { backgroundColor: accent.soft }]}>
          <Avatar emoji={activeMember.avatar} accent={activeMember.accent_color} size={84} ring />
          <Text style={styles.heroName}>{activeMember.name}</Text>
          <View style={styles.heroMeta}>
            <View style={[styles.roleTag, { backgroundColor: accent.color }]}>
              <Text style={[styles.roleTagText, { color: accent.on }]}>{isCapo ? "👑 Capo famiglia" : "Membro"}</Text>
            </View>
            <View style={[styles.roleTag, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.roleTagText, { color: accent.color }]}>⭐ {activeMember.points} punti</Text>
            </View>
          </View>
          <Pressable testID="edit-profile-btn" onPress={() => setEditOpen(true)} style={styles.editBtn}>
            <PencilSimple size={16} color={colors.onSurface} weight="bold" />
            <Text style={styles.editBtnText}>Modifica profilo</Text>
          </Pressable>
        </View>

        {/* Accent customization */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Il tuo colore</Text>
          <Text style={styles.sectionHint}>Personalizza l&apos;app con il tuo colore preferito.</Text>
          <View style={styles.accentRow}>
            {ACCENTS.map((ac) => {
              const sel = activeMember.accent_color === ac.id;
              return (
                <Pressable
                  key={ac.id}
                  testID={`profile-accent-${ac.id}`}
                  onPress={() => accentMutation.mutate(ac.id)}
                  style={[styles.accentDot, { backgroundColor: ac.color, borderColor: sel ? colors.onSurface : "transparent" }]}
                />
              );
            })}
          </View>
        </View>

        {/* Family + actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Famiglia</Text>
          <View style={styles.list}>
            <View style={styles.listRow}>
              <UsersThree size={22} color={accent.color} weight="fill" />
              <Text style={styles.listLabel}>{data?.family.name}</Text>
            </View>
            {isCapo ? (
              <Pressable testID="manage-members-btn" onPress={() => router.push("/manage-members")} style={styles.listRow}>
                <UsersThree size={22} color={accent.color} weight="fill" />
                <Text style={styles.listLabel}>Gestisci membri</Text>
                <CaretRight size={18} color={colors.muted} weight="bold" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Pressable testID="switch-user-btn" onPress={clearActiveMember} style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary }]}>
            <ArrowsClockwise size={20} color={colors.onSurface} weight="bold" />
            <Text style={styles.actionText}>Cambia utente</Text>
          </Pressable>
          <Pressable testID="signout-btn" onPress={signOut} style={[styles.actionBtn, { backgroundColor: colors.brandTertiary }]}>
            <SignOut size={20} color={colors.error} weight="bold" />
            <Text style={[styles.actionText, { color: colors.error }]}>Esci dalla famiglia</Text>
          </Pressable>
        </View>
      </ScrollView>

      <MemberSheet visible={editOpen} onClose={() => setEditOpen(false)} editing={activeMember} accent={accent.id} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  title: { fontFamily: Fonts.displayBold, fontSize: FontSize.huge, color: colors.onSurface },
  hero: { alignItems: "center", gap: Spacing.sm, borderRadius: Radius.lg, padding: Spacing.xl },
  heroName: { fontFamily: Fonts.displayBold, fontSize: FontSize.xxl, color: colors.onSurface },
  heroMeta: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap", justifyContent: "center" },
  roleTag: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill },
  roleTagText: { fontFamily: Fonts.bodyBold, fontSize: FontSize.sm },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, paddingHorizontal: Spacing.lg, paddingVertical: 10, borderRadius: Radius.pill, marginTop: Spacing.xs },
  editBtnText: { fontFamily: Fonts.bodyBold, fontSize: FontSize.base, color: colors.onSurface },
  section: { gap: Spacing.md },
  sectionTitle: { fontFamily: Fonts.displayBold, fontSize: FontSize.xl, color: colors.onSurface },
  sectionHint: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.muted, marginTop: -Spacing.xs },
  accentRow: { flexDirection: "row", gap: Spacing.md, flexWrap: "wrap" },
  accentDot: { width: 48, height: 48, borderRadius: Radius.pill, borderWidth: 3 },
  list: { backgroundColor: colors.surfaceSecondary, borderRadius: Radius.lg, overflow: "hidden" },
  listRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  listLabel: { flex: 1, fontFamily: Fonts.bodyBold, fontSize: FontSize.lg, color: colors.onSurface },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.pill },
  actionText: { fontFamily: Fonts.displayBold, fontSize: FontSize.lg, color: colors.onSurface },
}));

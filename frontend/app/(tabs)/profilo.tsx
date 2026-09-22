import { useState } from "react";
import { Platform, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { ArrowsClockwise, CaretRight, Copy, DeviceMobile, Gift, PencilSimple, ShareNetwork, SignOut, UsersThree } from "phosphor-react-native";

import { ACCENTS, accentById, Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { Avatar } from "@/src/components/ui";
import { MemberSheet } from "@/src/components/member-sheet";
import { ColorPickerSheet } from "@/src/components/color-picker-sheet";
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
  const [colorSheet, setColorSheet] = useState(false);
  const accent = accentById(activeMember?.accent_color);
  const isCapo = activeMember?.role === "capo";
  const code = data?.family.invite_code ?? "";

  const accentMutation = useMutation({
    mutationFn: (accentId: string) => api.updateMember(activeMember!.member_id, { accent_color: accentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      toast("Colore aggiornato 🎨", "success");
    },
  });

  const regen = useMutation({
    mutationFn: api.regenerateCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family"] });
      toast("Nuovo codice generato", "success");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const copyCode = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    toast("Codice copiato", "success");
  };

  const shareCode = async () => {
    if (!code) return;
    const message = Platform.OS === "web"
      ? `Unisciti alla nostra famiglia su Family Task! Apri ${window.location.origin}/join-family e inserisci il codice: ${code}`
      : `Unisciti alla nostra famiglia su Family Task! Apri l'app, scegli "Unisciti con un codice" e inserisci: ${code}`;
    try {
      if (Platform.OS === "web") {
        if (navigator.share) await navigator.share({ title: "Family Task", text: message });
        else { await Clipboard.setStringAsync(message); toast("Invito con link copiato", "success"); }
      } else await Share.share({ message });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) toast("Condivisione non riuscita. Puoi copiare il codice.", "error");
    }
  };

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
            <Pressable
              testID="profile-custom-color-btn"
              onPress={() => setColorSheet(true)}
              style={[styles.accentDot, styles.customDot, { backgroundColor: activeMember.accent_color.startsWith("#") ? activeMember.accent_color : colors.surfaceSecondary, borderColor: activeMember.accent_color.startsWith("#") ? colors.onSurface : colors.border }]}
            >
              <Text style={{ fontSize: 20 }}>🎨</Text>
            </Pressable>
          </View>
        </View>

        {/* Invite code */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Codice invito</Text>
          <View style={[styles.inviteCard, { backgroundColor: accent.soft }]}>
            <Text style={[styles.inviteCode, { color: accent.color }]} testID="invite-code">{code}</Text>
            <Text style={styles.inviteHint}>Condividi questo codice: i tuoi familiari potranno entrare dai loro telefoni.</Text>
            <View style={styles.inviteActions}>
              <Pressable testID="copy-code-btn" onPress={copyCode} style={[styles.inviteBtn, { backgroundColor: colors.surface }]}>
                <Copy size={18} color={colors.onSurface} weight="bold" />
                <Text style={styles.inviteBtnText}>Copia</Text>
              </Pressable>
              <Pressable testID="share-code-btn" onPress={shareCode} style={[styles.inviteBtn, { backgroundColor: accent.color }]}>
                <ShareNetwork size={18} color={accent.on} weight="bold" />
                <Text style={[styles.inviteBtnText, { color: accent.on }]}>Condividi</Text>
              </Pressable>
            </View>
            {isCapo ? (
              <Pressable testID="regen-code-btn" onPress={() => regen.mutate()} style={styles.regenBtn}>
                <ArrowsClockwise size={15} color={colors.muted} weight="bold" />
                <Text style={styles.regenText}>Genera nuovo codice</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Family + actions */}
        {Platform.OS === "web" && <View style={styles.section}>
          <Text testID="profile-webapp-title" style={styles.sectionTitle}>Family Task sul telefono</Text>
          <Pressable testID="profile-install-app-button" accessibilityRole="button" onPress={() => router.push("/install-app")} style={styles.listRow}>
            <DeviceMobile size={24} color={accent.color} weight="fill" />
            <Text style={styles.listLabel}>Installa e gestisci notifiche</Text>
            <CaretRight size={18} color={colors.muted} weight="bold" />
          </Pressable>
        </View>}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Famiglia</Text>
          <View style={styles.list}>
            <View style={styles.listRow}>
              <UsersThree size={22} color={accent.color} weight="fill" />
              <Text style={styles.listLabel}>{data?.family.name}</Text>
            </View>
            <Pressable testID="profile-rewards-btn" onPress={() => router.push("/rewards")} style={styles.listRow}>
              <Gift size={22} color={accent.color} weight="fill" />
              <Text style={styles.listLabel}>Premi</Text>
              <CaretRight size={18} color={colors.muted} weight="bold" />
            </Pressable>
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
          <Pressable testID="switch-user-btn" onPress={() => clearActiveMember().catch((e: Error) => toast(e.message, "error"))} style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary }]}>
            <ArrowsClockwise size={20} color={colors.onSurface} weight="bold" />
            <Text style={styles.actionText}>Cambia utente</Text>
          </Pressable>
          <Pressable testID="signout-btn" onPress={() => signOut().catch((e: Error) => toast(e.message, "error"))} style={[styles.actionBtn, { backgroundColor: colors.brandTertiary }]}>
            <SignOut size={20} color={colors.error} weight="bold" />
            <Text style={[styles.actionText, { color: colors.error }]}>Esci dalla famiglia</Text>
          </Pressable>
        </View>
      </ScrollView>

      <MemberSheet visible={editOpen} onClose={() => setEditOpen(false)} editing={activeMember} accent={accent.id} />
      <ColorPickerSheet visible={colorSheet} onClose={() => setColorSheet(false)} initial={activeMember.accent_color.startsWith("#") ? activeMember.accent_color : "#FF6B6B"} onSelect={(hex) => accentMutation.mutate(hex)} />
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
  customDot: { alignItems: "center", justifyContent: "center" },
  inviteCard: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md, alignItems: "center" },
  inviteCode: { fontFamily: Fonts.displayBold, fontSize: FontSize.huge, letterSpacing: 6 },
  inviteHint: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.onSurface, textAlign: "center", lineHeight: 18, opacity: 0.8 },
  inviteActions: { flexDirection: "row", gap: Spacing.md, alignSelf: "stretch" },
  inviteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: Radius.pill },
  inviteBtnText: { fontFamily: Fonts.displayBold, fontSize: FontSize.base, color: colors.onSurface },
  regenBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: Spacing.xs },
  regenText: { fontFamily: Fonts.bodyBold, fontSize: FontSize.sm, color: colors.muted },
  list: { backgroundColor: colors.surfaceSecondary, borderRadius: Radius.lg, overflow: "hidden" },
  listRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  listLabel: { flex: 1, fontFamily: Fonts.bodyBold, fontSize: FontSize.lg, color: colors.onSurface },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.pill },
  actionText: { fontFamily: Fonts.displayBold, fontSize: FontSize.lg, color: colors.onSurface },
}));

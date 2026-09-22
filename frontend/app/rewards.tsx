import { useEffect, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, PencilSimple, Trash, X } from "phosphor-react-native";

import { accentById, Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { Avatar, Btn, IconBubble, PointsPill, haptic } from "@/src/components/ui";
import { getIcon, REWARD_ICONS } from "@/src/icons";
import { api, type Reward } from "@/src/api";
import { useApp } from "@/src/app-context";
import { useToast } from "@/src/components/toast";
import { dayjs } from "@/src/date";

export default function Rewards() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeMember, members } = useApp();
  const queryClient = useQueryClient();
  const toast = useToast();

  const isCapo = activeMember?.role === "capo";
  const accent = accentById(activeMember?.accent_color);
  const points = activeMember?.points ?? 0;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const rewardsQuery = useQuery({ queryKey: ["rewards"], queryFn: api.rewards });
  const redemptionsQuery = useQuery({ queryKey: ["redemptions"], queryFn: api.redemptions });

  const redeemMutation = useMutation({
    mutationFn: (id: string) => api.redeemReward(id),
    onSuccess: (data) => {
      haptic("success");
      queryClient.invalidateQueries({ queryKey: ["family"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["redemptions"] });
      toast(`Riscattato! Ti restano ${data.member.points} punti 🎉`, "success");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteReward(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      toast("Premio rimosso", "success");
      setConfirmId(null);
    },
  });

  const rewards = rewardsQuery.data ?? [];
  const redemptions = redemptionsQuery.data ?? [];
  const memberById = Object.fromEntries(members.map((m) => [m.member_id, m]));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable testID="rewards-back-btn" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={styles.headerTitle}>🎁 Premi</Text>
        <PointsPill points={points} accent={accent.id} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.xl, paddingBottom: insets.bottom + Spacing.xxl, gap: Spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={rewardsQuery.isFetching} onRefresh={() => { rewardsQuery.refetch(); redemptionsQuery.refetch(); }} tintColor={accent.color} />}
      >
        {isCapo ? (
          <Btn label="Nuovo premio" testID="add-reward-btn" accent={accent.id} icon={<Plus size={22} color={accent.on} weight="bold" />} onPress={() => { setEditing(null); setSheetOpen(true); }} />
        ) : null}

        {rewards.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 56 }}>🎁</Text>
            <Text style={styles.emptyTitle}>Ancora nessun premio</Text>
            <Text style={styles.emptySub}>{isCapo ? "Crea il primo premio da far riscattare con i punti!" : "Il capo famiglia non ha ancora aggiunto premi."}</Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.md }}>
            {rewards.map((r) => {
              const affordable = points >= r.cost;
              return (
                <View key={r.id} style={styles.card} testID={`reward-${r.id}`}>
                  <IconBubble icon={r.icon} color={accent.id} bubble={52} size={26} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rewardTitle}>{r.title}</Text>
                    <Text style={styles.rewardCost}>⭐ {r.cost} punti</Text>
                  </View>
                  {confirmId === r.id ? (
                    <Pressable testID={`reward-confirm-delete-${r.id}`} onPress={() => deleteMutation.mutate(r.id)} style={[styles.redeemBtn, { backgroundColor: colors.error }]}>
                      <Text style={[styles.redeemText, { color: colors.onError }]}>Elimina</Text>
                    </Pressable>
                  ) : isCapo ? (
                    <View style={styles.capoActions}>
                      <Pressable testID={`reward-edit-${r.id}`} onPress={() => { setEditing(r); setSheetOpen(true); }} style={[styles.iconBtn, { backgroundColor: accent.soft }]}>
                        <PencilSimple size={18} color={accent.color} weight="bold" />
                      </Pressable>
                      <Pressable testID={`reward-delete-${r.id}`} onPress={() => setConfirmId(r.id)} style={[styles.iconBtn, { backgroundColor: colors.brandTertiary }]}>
                        <Trash size={18} color={colors.error} weight="bold" />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      testID={`redeem-${r.id}`}
                      disabled={!affordable || redeemMutation.isPending}
                      onPress={() => redeemMutation.mutate(r.id)}
                      style={[styles.redeemBtn, { backgroundColor: affordable ? accent.color : colors.surfaceTertiary }]}
                    >
                      <Text style={[styles.redeemText, { color: affordable ? accent.on : colors.muted }]}>{affordable ? "Riscatta" : "Mancano punti"}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {redemptions.length > 0 ? (
          <View style={{ gap: Spacing.md, marginTop: Spacing.md }}>
            <Text style={styles.sectionTitle}>Riscatti recenti</Text>
            {redemptions.map((rd) => {
              const m = memberById[rd.member_id];
              const RIcon = getIcon(rd.reward_icon);
              return (
                <View key={rd.id} style={styles.histRow} testID={`redemption-${rd.id}`}>
                  <Avatar emoji={m?.avatar ?? rd.member_avatar ?? "🙂"} accent={m?.accent_color ?? "coral"} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histName}>{rd.member_name}</Text>
                    <Text style={styles.histMeta}>{rd.reward_title} · {dayjs(rd.created_at).format("D MMM HH:mm")}</Text>
                  </View>
                  <View style={styles.histCost}>
                    <RIcon size={16} color={colors.muted} weight="fill" />
                    <Text style={styles.histCostText}>−{rd.cost}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <RewardSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} editing={editing} accent={accent.id} />
    </View>
  );
}

function RewardSheet({ visible, onClose, editing, accent }: { visible: boolean; onClose: () => void; editing: Reward | null; accent: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("gift");
  const [cost, setCost] = useState("50");

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setTitle(editing.title);
      setIcon(editing.icon);
      setCost(String(editing.cost));
    } else {
      setTitle("");
      setIcon("gift");
      setCost("50");
    }
  }, [visible, editing]);

  const mutation = useMutation({
    mutationFn: () => {
      const body = { title: title.trim(), icon, cost: parseInt(cost || "0", 10) };
      return editing ? api.updateReward(editing.id, body) : api.addReward(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      toast(editing ? "Premio aggiornato" : "Premio creato! 🎁", "success");
      onClose();
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const canSave = title.trim().length > 0 && parseInt(cost || "0", 10) > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} testID="reward-sheet-backdrop" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{editing ? "Modifica premio" : "Nuovo premio"}</Text>
            <Pressable testID="close-reward-sheet" onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={20} color={colors.onSurface} weight="bold" />
            </Pressable>
          </View>
          <KeyboardAwareScrollView contentContainerStyle={{ gap: Spacing.lg, paddingBottom: Spacing.lg }} bottomOffset={20} showsVerticalScrollIndicator={false}>
            <View style={styles.field}>
              <Text style={styles.label}>Titolo</Text>
              <TextInput testID="input-reward-title" value={title} onChangeText={setTitle} placeholder="Es. 1 ora di videogiochi" placeholderTextColor={colors.muted} style={styles.input} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Icona</Text>
              <View style={styles.iconGrid}>
                {REWARD_ICONS.map((ic) => {
                  const Icon = getIcon(ic);
                  const sel = icon === ic;
                  return (
                    <Pressable key={ic} testID={`reward-icon-${ic}`} onPress={() => setIcon(ic)} style={[styles.iconCell, { backgroundColor: sel ? accentById(accent).soft : colors.surfaceTertiary, borderColor: sel ? accentById(accent).color : "transparent" }]}>
                      <Icon size={24} color={sel ? accentById(accent).color : colors.onSurfaceTertiary} weight="fill" />
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Costo in punti</Text>
              <TextInput testID="input-reward-cost" value={cost} onChangeText={(t) => setCost(t.replace(/[^0-9]/g, "").slice(0, 5))} keyboardType="number-pad" placeholder="50" placeholderTextColor={colors.muted} style={styles.input} />
            </View>
            <Btn label={editing ? "Salva" : "Crea premio"} testID="save-reward-btn" accent={accent} loading={mutation.isPending} disabled={!canSave} onPress={() => mutation.mutate()} />
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  backBtn: { width: 40, height: 40, borderRadius: Radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontFamily: Fonts.displayBold, fontSize: FontSize.xl, color: colors.onSurface },
  empty: { alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.xxxl },
  emptyTitle: { fontFamily: Fonts.displayBold, fontSize: FontSize.xl, color: colors.onSurface },
  emptySub: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.muted, textAlign: "center", paddingHorizontal: Spacing.xl },
  card: { flexDirection: "row", alignItems: "center", gap: Spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: Radius.lg, padding: Spacing.md },
  rewardTitle: { fontFamily: Fonts.displayBold, fontSize: FontSize.lg, color: colors.onSurface },
  rewardCost: { fontFamily: Fonts.bodySemibold, fontSize: FontSize.sm, color: colors.muted, marginTop: 2 },
  redeemBtn: { paddingHorizontal: Spacing.lg, paddingVertical: 10, borderRadius: Radius.pill },
  redeemText: { fontFamily: Fonts.displayBold, fontSize: FontSize.base },
  capoActions: { flexDirection: "row", gap: Spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontFamily: Fonts.displayBold, fontSize: FontSize.xl, color: colors.onSurface },
  histRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: Radius.md, padding: Spacing.md },
  histName: { fontFamily: Fonts.displayBold, fontSize: FontSize.base, color: colors.onSurface },
  histMeta: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.muted, marginTop: 2 },
  histCost: { flexDirection: "row", alignItems: "center", gap: 4 },
  histCostText: { fontFamily: Fonts.displayBold, fontSize: FontSize.base, color: colors.muted },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, maxHeight: "90%" },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: Radius.pill, backgroundColor: colors.border, marginBottom: Spacing.md },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.lg },
  sheetTitle: { fontFamily: Fonts.displayBold, fontSize: FontSize.xxl, color: colors.onSurface },
  closeBtn: { width: 36, height: 36, borderRadius: Radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  field: { gap: Spacing.sm },
  label: { fontFamily: Fonts.bodyBold, fontSize: FontSize.base, color: colors.onSurface },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 14, fontFamily: Fonts.bodySemibold, fontSize: FontSize.lg, color: colors.onSurface, borderWidth: 1, borderColor: colors.border },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  iconCell: { width: 52, height: 52, borderRadius: Radius.md, alignItems: "center", justifyContent: "center", borderWidth: 2 },
}));

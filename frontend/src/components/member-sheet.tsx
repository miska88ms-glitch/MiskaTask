import { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "phosphor-react-native";

import { ACCENTS, accentById, AVATARS, Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { Btn } from "@/src/components/ui";
import { ColorPickerSheet } from "@/src/components/color-picker-sheet";
import { api, type Member } from "@/src/api";
import { useToast } from "@/src/components/toast";

export function MemberSheet({
  visible,
  onClose,
  editing,
  accent = "coral",
}: {
  visible: boolean;
  onClose: () => void;
  editing?: Member | null;
  accent?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🐼");
  const [color, setColor] = useState("mint");
  const [role, setRole] = useState<"capo" | "membro">("membro");
  const [pin, setPin] = useState("");
  const [colorSheet, setColorSheet] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setName(editing.name);
      setAvatar(editing.avatar);
      setColor(editing.accent_color);
      setRole(editing.role);
      setPin("");
    } else {
      setName("");
      setAvatar("🐼");
      setColor("mint");
      setRole("membro");
      setPin("");
    }
  }, [visible, editing]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { name: name.trim(), avatar, accent_color: color, role };
      if (pin.length === 4) body.pin = pin;
      if (editing) return api.updateMember(editing.member_id, body);
      return api.addMember(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      toast(editing ? "Membro aggiornato" : "Membro aggiunto! 👋", "success");
      onClose();
    },
    onError: (e: Error) => toast(e.message || "Errore", "error"),
  });

  const canSave = name.trim().length > 0 && (pin.length === 0 || pin.length === 4);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} testID="member-sheet-backdrop" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{editing ? "Modifica membro" : "Nuovo membro"}</Text>
            <Pressable testID="close-member-sheet" onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={20} color={colors.onSurface} weight="bold" />
            </Pressable>
          </View>

          <KeyboardAwareScrollView contentContainerStyle={{ gap: Spacing.lg, paddingBottom: Spacing.lg }} bottomOffset={20} showsVerticalScrollIndicator={false}>
            <View style={styles.field}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                testID="input-member-name"
                value={name}
                onChangeText={setName}
                placeholder="Es. Luca"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Avatar</Text>
              <View style={styles.avatarGrid}>
                {AVATARS.map((em) => (
                  <Pressable
                    key={em}
                    testID={`member-avatar-${em}`}
                    onPress={() => setAvatar(em)}
                    style={[styles.avatarCell, { backgroundColor: avatar === em ? accentById(color).soft : colors.surfaceTertiary, borderColor: avatar === em ? accentById(color).color : "transparent" }]}
                  >
                    <Text style={{ fontSize: 24 }}>{em}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Colore</Text>
              <View style={styles.accentRow}>
                {ACCENTS.map((ac) => (
                  <Pressable
                    key={ac.id}
                    testID={`member-accent-${ac.id}`}
                    onPress={() => setColor(ac.id)}
                    style={[styles.accentDot, { backgroundColor: ac.color, borderColor: color === ac.id ? colors.onSurface : "transparent" }]}
                  />
                ))}
                <Pressable
                  testID="member-custom-color-btn"
                  onPress={() => setColorSheet(true)}
                  style={[styles.accentDot, styles.customDot, { backgroundColor: color.startsWith("#") ? color : colors.surfaceTertiary, borderColor: color.startsWith("#") ? colors.onSurface : colors.border }]}
                >
                  <Text style={{ fontSize: 16 }}>🎨</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Ruolo</Text>
              <View style={styles.segment}>
                {(["membro", "capo"] as const).map((r) => (
                  <Pressable
                    key={r}
                    testID={`role-${r}`}
                    onPress={() => setRole(r)}
                    style={[styles.segmentBtn, role === r && { backgroundColor: accentById(color).color }]}
                  >
                    <Text style={[styles.segmentText, role === r && { color: accentById(color).on }]}>
                      {r === "capo" ? "Capo famiglia" : "Membro"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>PIN {editing ? "(lascia vuoto per non cambiarlo)" : "(facoltativo)"}</Text>
              <TextInput
                testID="input-member-pin"
                value={pin}
                onChangeText={(t) => setPin(t.replace(/[^0-9]/g, "").slice(0, 4))}
                placeholder="4 cifre"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                secureTextEntry
                style={styles.input}
              />
            </View>

            <Btn label={editing ? "Salva" : "Aggiungi membro"} testID="save-member-btn" accent={accent} loading={mutation.isPending} disabled={!canSave} onPress={() => mutation.mutate()} />
          </KeyboardAwareScrollView>
        </View>
      </View>
      <ColorPickerSheet visible={colorSheet} onClose={() => setColorSheet(false)} initial={color.startsWith("#") ? color : "#22A559"} onSelect={setColor} />
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  backdropTap: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    maxHeight: "90%",
  },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: Radius.pill, backgroundColor: colors.border, marginBottom: Spacing.md },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.lg },
  sheetTitle: { fontFamily: Fonts.displayBold, fontSize: FontSize.xxl, color: colors.onSurface },
  closeBtn: { width: 36, height: 36, borderRadius: Radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  field: { gap: Spacing.sm },
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
  avatarGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  avatarCell: { width: 48, height: 48, borderRadius: Radius.md, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  accentRow: { flexDirection: "row", gap: Spacing.md, flexWrap: "wrap" },
  accentDot: { width: 40, height: 40, borderRadius: Radius.pill, borderWidth: 3 },
  customDot: { alignItems: "center", justifyContent: "center" },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: Radius.pill, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.pill, alignItems: "center" },
  segmentText: { fontFamily: Fonts.displayBold, fontSize: FontSize.base, color: colors.onSurfaceTertiary },
}));

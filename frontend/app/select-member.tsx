import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { ArrowLeft, SignOut } from "phosphor-react-native";

import { accentById, Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { Avatar } from "@/src/components/ui";
import { PinPad } from "@/src/components/pin-pad";
import { useApp } from "@/src/app-context";
import { api, type Member } from "@/src/api";
import { useToast } from "@/src/components/toast";

export default function SelectMember() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, members, selectMember, signOut } = useApp();
  const toast = useToast();

  const [pending, setPending] = useState<Member | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const onPickMember = async (m: Member) => {
    if (!m.has_pin) {
      try {
        // Activates this profile on the server session (no PIN set).
        await api.verifyPin(m.member_id, "");
        await selectMember(m);
      } catch (e) {
        toast((e as Error).message, "error");
      }
      return;
    }
    setPending(m);
    setPin("");
    setError(false);
  };

  const submitPin = async (value: string) => {
    if (!pending || checking) return;
    setChecking(true);
    try {
      await api.verifyPin(pending.member_id, value);
      await selectMember(pending);
    } catch {
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 600);
    } finally {
      setChecking(false);
    }
  };

  const onChangePin = (v: string) => {
    setPin(v);
    if (v.length === 4 && pending) void submitPin(v);
  };

  if (pending) {
    const a = accentById(pending.accent_color);
    return (
      <View style={styles.root}>
        <View style={[styles.pinHeader, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable testID="pin-back-btn" onPress={() => setPending(null)} hitSlop={10} style={styles.backBtn}>
            <ArrowLeft size={24} color={colors.onSurface} weight="bold" />
          </Pressable>
          <View style={{ width: 40 }} />
        </View>
        <Animated.View entering={FadeIn} style={styles.pinBody}>
          <Avatar emoji={pending.avatar} accent={pending.accent_color} size={96} ring />
          <Text style={styles.pinName}>Ciao {pending.name}!</Text>
          <Text style={styles.pinHint}>Inserisci il tuo PIN</Text>
          <PinPad value={pin} onChange={onChangePin} length={4} accent={pending.accent_color} error={error} />
          {checking ? <Text style={[styles.pinHint, { color: a.color }]}>Verifica...</Text> : null}
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + Spacing.xxl, paddingHorizontal: Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }}
      >
        <Text style={styles.title}>Chi sei?</Text>
        <Text style={styles.subtitle}>{data?.family.name}</Text>

        <View style={styles.grid}>
          {members.map((m) => (
            <Pressable
              key={m.member_id}
              testID={`select-member-${m.member_id}`}
              onPress={() => onPickMember(m)}
              style={({ pressed }) => [styles.memberCell, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <Avatar emoji={m.avatar} accent={m.accent_color} size={84} />
              <Text style={styles.memberName}>{m.name}</Text>
              {m.role === "capo" ? (
                <View style={[styles.badge, { backgroundColor: accentById(m.accent_color).soft }]}>
                  <Text style={[styles.badgeText, { color: accentById(m.accent_color).color }]}>Capo</Text>
                </View>
              ) : (
                <Text style={styles.pinLabel}>{m.has_pin ? "🔒 PIN" : "Tocca per entrare"}</Text>
              )}
            </Pressable>
          ))}
        </View>

        <Pressable testID="signout-link" onPress={signOut} style={styles.signout}>
          <SignOut size={18} color={colors.muted} weight="bold" />
          <Text style={styles.signoutText}>Esci dalla famiglia</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  title: { fontFamily: Fonts.displayBold, fontSize: FontSize.huge, color: colors.onSurface },
  subtitle: { fontFamily: Fonts.bodySemibold, fontSize: FontSize.lg, color: colors.muted, marginTop: 4, marginBottom: Spacing.xl },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: Spacing.xl },
  memberCell: { width: "48%", alignItems: "center", gap: Spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: Radius.lg, paddingVertical: Spacing.lg },
  memberName: { fontFamily: Fonts.displayBold, fontSize: FontSize.lg, color: colors.onSurface },
  badge: { paddingHorizontal: Spacing.md, paddingVertical: 3, borderRadius: Radius.pill },
  badgeText: { fontFamily: Fonts.bodyBold, fontSize: FontSize.sm },
  pinLabel: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.muted },
  signout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, marginTop: Spacing.xxxl },
  signoutText: { fontFamily: Fonts.bodyBold, fontSize: FontSize.base, color: colors.muted },
  pinHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: Radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  pinBody: { flex: 1, alignItems: "center", gap: Spacing.md, paddingTop: Spacing.xl },
  pinName: { fontFamily: Fonts.displayBold, fontSize: FontSize.xxl, color: colors.onSurface, marginTop: Spacing.sm },
  pinHint: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.muted },
}));

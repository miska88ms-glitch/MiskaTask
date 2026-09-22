import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ColorPicker, { HueSlider, Panel1, Preview } from "reanimated-color-picker";
import { X } from "phosphor-react-native";

import { Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";
import { Btn } from "@/src/components/ui";

export function ColorPickerSheet({
  visible,
  onClose,
  initial,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  initial: string;
  onSelect: (hex: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState(initial.startsWith("#") ? initial : "#FF6B6B");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} testID="color-sheet-backdrop" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>Colore personalizzato</Text>
            <Pressable testID="close-color-sheet" onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={20} color={colors.onSurface} weight="bold" />
            </Pressable>
          </View>

          <ColorPicker
            style={{ gap: Spacing.lg }}
            value={picked}
            onComplete={(res) => setPicked(res.hex)}
          >
            <Preview hideInitialColor style={styles.preview} textStyle={{ fontFamily: Fonts.displayBold }} />
            <Panel1 style={styles.panel} />
            <HueSlider style={styles.hue} />
          </ColorPicker>

          <Btn
            label="Usa questo colore"
            testID="confirm-color-btn"
            accent={picked}
            onPress={() => {
              onSelect(picked);
              onClose();
            }}
          />
        </View>
      </View>
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
    gap: Spacing.lg,
  },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: Radius.pill, backgroundColor: colors.border },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: Fonts.displayBold, fontSize: FontSize.xxl, color: colors.onSurface },
  closeBtn: { width: 36, height: 36, borderRadius: Radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  preview: { height: 44, borderRadius: Radius.md },
  panel: { height: 200, borderRadius: Radius.md },
  hue: { borderRadius: Radius.pill },
}));

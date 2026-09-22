import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fonts, FontSize, makeStyles, Radius, Spacing, useTheme } from "@/src/theme";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; message: string; kind: ToastKind };

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const counter = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++counter.current;
    setToast({ id, message, kind });
    setTimeout(() => {
      setToast((cur) => (cur && cur.id === id ? null : cur));
    }, 2600);
  }, []);

  const bg =
    toast?.kind === "success"
      ? colors.success
      : toast?.kind === "error"
        ? colors.error
        : colors.surfaceInverse;
  const fg =
    toast?.kind === "success"
      ? colors.onSuccess
      : toast?.kind === "error"
        ? colors.onError
        : colors.onSurfaceInverse;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          entering={FadeInDown.springify()}
          exiting={FadeOutUp}
          pointerEvents="none"
          style={[styles.wrap, { top: insets.top + Spacing.md }]}
          testID="app-toast"
        >
          <View style={[styles.toast, { backgroundColor: bg }]}>
            <Text style={[styles.text, { color: fg }]}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const useStyles = makeStyles(() => ({
  wrap: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    alignItems: "center",
    zIndex: 1000,
  },
  toast: {
    maxWidth: "100%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    ...StyleSheet.flatten({
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    }),
  },
  text: { fontFamily: Fonts.bodyBold, fontSize: FontSize.base },
}));

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api, setActiveMemberIdHeader, setAuthToken, type FamilyPayload, type Member } from "@/src/api";
import { storage } from "@/src/utils/storage";
import { registerForPush } from "@/src/push";
import { detachWebPush } from "@/src/pwa/web-push";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "fam_session_token";
const ACTIVE_KEY = "fam_active_member";

type Status = "loading" | "unauth" | "auth";

type AppContextValue = {
  status: Status;
  token: string | null;
  data: FamilyPayload | null;
  members: Member[];
  activeMember: Member | null;
  signInWithGoogle: () => Promise<void>;
  createFamily: (body: {
    family_name: string;
    capo_name: string;
    pin?: string;
    avatar: string;
    accent_color: string;
  }) => Promise<void>;
  joinFamily: (code: string) => Promise<void>;
  selectMember: (member: Member) => Promise<void>;
  clearActiveMember: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const processed = useRef<Set<string>>(new Set());

  const setToken = (t: string | null) => {
    setAuthToken(t);
    setTokenState(t);
  };

  const familyQuery = useQuery({
    queryKey: ["family"],
    queryFn: api.family,
    enabled: !!token,
    retry: false,
  });

  // On any auth failure, wipe the session.
  useEffect(() => {
    const err = familyQuery.error as (Error & { status?: number }) | null;
    if (err && err.status === 401) {
      void signOut().catch(() => console.warn("Impossibile completare l’uscita: notifiche ancora attive"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyQuery.error]);

  const applySession = async (payload: FamilyPayload & { session_token: string }) => {
    await storage.secureSet(TOKEN_KEY, payload.session_token);
    setToken(payload.session_token);
    queryClient.setQueryData(["family"], {
      user: payload.user,
      family: payload.family,
      members: payload.members,
    });
  };

  const exchangeSessionId = async (sessionId: string) => {
    if (processed.current.has(sessionId)) return;
    processed.current.add(sessionId);
    try {
      const payload = await api.googleSession(sessionId);
      await applySession(payload);
    } catch (e) {
      console.error("Google session exchange failed", e);
    }
  };

  // Bootstrap: detect session_id (web/mobile), else restore stored token.
  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    (async () => {
      try {
        if (Platform.OS === "web") {
          const url = window.location.href;
          const match = url.match(/[?#&]session_id=([^&#]+)/);
          if (match) {
            await exchangeSessionId(decodeURIComponent(match[1]));
            const clean = new URL(window.location.href);
            clean.hash = "";
            clean.searchParams.delete("session_id");
            window.history.replaceState(window.history.state, "", clean.toString());
            const storedActive = await storage.getItem<string | null>(ACTIVE_KEY, null);
            if (storedActive) setActiveMemberId(storedActive);
            setBootstrapped(true);
            return;
          }
        } else {
          const initial = await Linking.getInitialURL();
          const m = initial?.match(/[?#&]session_id=([^&#]+)/);
          if (m) await exchangeSessionId(decodeURIComponent(m[1]));
          sub = Linking.addEventListener("url", ({ url }) => {
            const mm = url.match(/[?#&]session_id=([^&#]+)/);
            if (mm) void exchangeSessionId(decodeURIComponent(mm[1]));
          });
        }

        const stored = await storage.secureGet<string | null>(TOKEN_KEY, null);
        if (stored && !token) setToken(stored);
        const storedActive = await storage.getItem<string | null>(ACTIVE_KEY, null);
        if (storedActive) setActiveMemberId(storedActive);
      } finally {
        setBootstrapped(true);
      }
    })();
    return () => sub?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep active member header in sync.
  useEffect(() => {
    setActiveMemberIdHeader(activeMemberId);
  }, [activeMemberId]);

  // Register this device for push under the active member id (best-effort).
  useEffect(() => {
    if (token && activeMemberId) void registerForPush(activeMemberId);
  }, [token, activeMemberId]);

  const members = familyQuery.data?.members ?? [];
  const activeMember = members.find((m) => m.member_id === activeMemberId) ?? null;

  const signInWithGoogle = async () => {
    const redirectUrl =
      Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let callbackUrl: string | null = null;
    if (result.type === "success" && result.url) callbackUrl = result.url;
    if (!callbackUrl) callbackUrl = await Linking.getInitialURL();
    if (callbackUrl) {
      const m = callbackUrl.match(/[?#&]session_id=([^&#]+)/);
      if (m) await exchangeSessionId(decodeURIComponent(m[1]));
    }
  };

  const createFamily: AppContextValue["createFamily"] = async (body) => {
    const payload = await api.createFamily(body);
    await applySession(payload);
    // Auto-select the capo we just created.
    const capo = payload.members.find((m) => m.role === "capo") ?? payload.members[0];
    if (capo) await selectMember(capo);
  };

  const joinFamily: AppContextValue["joinFamily"] = async (code) => {
    const payload = await api.joinFamily(code);
    await applySession(payload);
    // Do NOT auto-select — the joining person picks their own profile + PIN.
  };

  const selectMember: AppContextValue["selectMember"] = async (member) => {
    if (activeMemberId && activeMemberId !== member.member_id) await detachWebPush();
    setActiveMemberId(member.member_id);
    setActiveMemberIdHeader(member.member_id);
    await storage.setItem(ACTIVE_KEY, member.member_id);
  };

  const clearActiveMember = async () => {
    await detachWebPush();
    setActiveMemberId(null);
    setActiveMemberIdHeader(null);
    await storage.removeItem(ACTIVE_KEY);
  };

  const signOut = async () => {
    await detachWebPush();
    await storage.secureRemove(TOKEN_KEY);
    await storage.removeItem(ACTIVE_KEY);
    setAuthToken(null);
    setActiveMemberIdHeader(null);
    setTokenState(null);
    setActiveMemberId(null);
    queryClient.clear();
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["family"] });
  };

  let status: Status = "loading";
  if (bootstrapped) {
    if (!token) status = "unauth";
    else if (familyQuery.isSuccess) status = "auth";
    else if (familyQuery.isError) status = "unauth";
    else status = "loading";
  }

  return (
    <AppContext.Provider
      value={{
        status,
        token,
        data: familyQuery.data ?? null,
        members,
        activeMember,
        signInWithGoogle,
        createFamily,
        joinFamily,
        selectMember,
        clearActiveMember,
        signOut,
        refresh,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function useAccent() {
  const { activeMember } = useApp();
  return activeMember?.accent_color ?? "coral";
}

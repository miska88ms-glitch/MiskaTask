// Lightweight API client. Auth token + active member id are held in module
// scope and injected into every request. AuthContext/FamilyContext set them.

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

let authToken: string | null = null;
let activeMemberId: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}
export function setActiveMemberIdHeader(id: string | null) {
  activeMemberId = id;
}

export type Member = {
  member_id: string;
  family_id: string;
  name: string;
  avatar: string;
  accent_color: string;
  role: "capo" | "membro";
  points: number;
  has_pin: boolean;
};

export type Family = { family_id: string; name: string; invite_code: string | null };

export type FamilyPayload = {
  user: { user_id: string; name: string; email: string | null };
  family: Family;
  members: Member[];
};

export type Activity = {
  id: string;
  family_id: string;
  type: "compito" | "impegno";
  title: string;
  icon: string;
  points: number;
  assigned_to: string;
  date: string;
  time: string | null;
  end_time: string | null;
  note: string | null;
  has_note: boolean;
  comment_count: number;
  status: "todo" | "done";
  created_by: string;
  completed_by: string | null;
  completed_at: string | null;
};

export type Preset = { title: string; icon: string; points: number };

export type Reward = { id: string; family_id: string; title: string; icon: string; cost: number };

export type Redemption = {
  id: string;
  reward_id: string;
  reward_title: string;
  reward_icon: string;
  member_id: string;
  member_name: string;
  member_avatar: string;
  cost: number;
  created_at: string;
};

export type Comment = {
  id: string;
  activity_id: string;
  member_id: string;
  member_name: string;
  member_avatar: string;
  member_accent: string;
  text: string;
  created_at: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  if (activeMemberId) headers["X-Member-Id"] = activeMemberId;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = (data && (data.detail || data.message)) || "Errore di rete";
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const api = {
  googleSession: (session_id: string) =>
    request<FamilyPayload & { session_token: string }>("/auth/session", {
      method: "POST",
      body: JSON.stringify({ session_id }),
    }),

  createFamily: (body: {
    family_name: string;
    capo_name: string;
    pin?: string;
    avatar: string;
    accent_color: string;
  }) =>
    request<FamilyPayload & { session_token: string }>("/family/create", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  joinFamily: (code: string) =>
    request<FamilyPayload & { session_token: string }>("/family/join", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  regenerateCode: () =>
    request<{ invite_code: string }>("/family/regenerate-code", { method: "POST" }),

  registerPush: (body: { user_id: string; platform: string; device_token: string }) =>
    request<{ status: string }>("/register-push", { method: "POST", body: JSON.stringify(body) }),

  me: () => request<FamilyPayload>("/auth/me"),
  family: () => request<FamilyPayload>("/family"),

  addMember: (body: Partial<Member> & { pin?: string }) =>
    request<Member>("/family/members", { method: "POST", body: JSON.stringify(body) }),
  updateMember: (id: string, body: Record<string, unknown>) =>
    request<Member>(`/family/members/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteMember: (id: string) =>
    request<{ ok: boolean }>(`/family/members/${id}`, { method: "DELETE" }),
  verifyPin: (id: string, pin: string) =>
    request<{ ok: boolean; member: Member }>(`/family/members/${id}/verify-pin`, {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),

  activities: (start: string, end: string) =>
    request<Activity[]>(`/activities?start=${start}&end=${end}`),
  activity: (id: string) => request<Activity>(`/activities/${id}`),
  createActivity: (body: Record<string, unknown>) =>
    request<Activity>("/activities", { method: "POST", body: JSON.stringify(body) }),
  updateActivity: (id: string, body: Record<string, unknown>) =>
    request<Activity>(`/activities/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  completeActivity: (id: string) =>
    request<Activity>(`/activities/${id}/complete`, { method: "POST" }),
  uncompleteActivity: (id: string) =>
    request<Activity>(`/activities/${id}/uncomplete`, { method: "POST" }),
  deleteActivity: (id: string) =>
    request<{ ok: boolean }>(`/activities/${id}`, { method: "DELETE" }),

  leaderboard: () => request<Member[]>("/leaderboard"),
  presets: () => request<Preset[]>("/presets"),

  comments: (activityId: string) => request<Comment[]>(`/activities/${activityId}/comments`),
  addComment: (activityId: string, text: string) =>
    request<Comment>(`/activities/${activityId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  rewards: () => request<Reward[]>("/rewards"),
  addReward: (body: { title: string; icon: string; cost: number }) =>
    request<Reward>("/rewards", { method: "POST", body: JSON.stringify(body) }),
  updateReward: (id: string, body: Record<string, unknown>) =>
    request<Reward>(`/rewards/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteReward: (id: string) => request<{ ok: boolean }>(`/rewards/${id}`, { method: "DELETE" }),
  redeemReward: (id: string) =>
    request<{ redemption: Redemption; member: Member }>(`/rewards/${id}/redeem`, { method: "POST" }),
  redemptions: () => request<Redemption[]>("/redemptions"),
};

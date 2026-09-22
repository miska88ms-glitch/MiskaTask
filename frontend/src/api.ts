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

export type Family = { family_id: string; name: string };

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
  note: string | null;
  status: "todo" | "done";
  created_by: string;
  completed_by: string | null;
  completed_at: string | null;
};

export type Preset = { title: string; icon: string; points: number };

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
};

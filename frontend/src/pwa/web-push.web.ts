import { api } from "@/src/api";

export function webPushSupported(): boolean {
  return window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function webRegistration(): Promise<ServiceWorkerRegistration> {
  if (!webPushSupported()) throw new Error("Questo browser non supporta le notifiche web.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Preparazione delle notifiche non riuscita. Riprova tra poco.")), 10000); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

export function publicKeyBytes(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// Per-device removal, not a blanket opt-out on other family devices.
// Run before changing the current actor/token. Never silently re-enable afterwards.
export async function detachWebPush(): Promise<void> {
  if (!webPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  let serverRemoved = false;
  let browserRemoved = false;
  try { await api.removeWebPush(subscription.endpoint); serverRemoved = true; } catch { /* A revoked session may no longer access the backend. */ }
  try { browserRemoved = await subscription.unsubscribe(); } catch { /* Try both independent removal paths. */ }
  const visible = await registration.getNotifications().catch(() => []);
  visible.forEach((notification) => notification.close());
  if (!serverRemoved && !browserRemoved) throw new Error("Impossibile disattivare gli avvisi del profilo. Controlla la connessione e riprova.");
}
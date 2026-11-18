/**
 * Web Push phía trình duyệt: đăng ký service worker, xin quyền, lưu
 * subscription vào bảng `push_subscriptions`.
 *
 * Quy tắc xin quyền: KHÔNG xin lúc login. Chỉ xin sau khi user vừa follow
 * 1 admin (đúng lúc có lý do) hoặc khi user tự bật trong Cá nhân. Bị từ
 * chối thì trình duyệt không cho hiện lại hộp xin quyền — user phải tự bật
 * trong cài đặt trình duyệt, nên phải hỏi mềm (giải thích trước) rồi mới
 * gọi Notification.requestPermission().
 */
import { supabase } from "@/integrations/supabase/client";

const SOFT_ASK_KEY = "zth:push-soft-ask";
const MAX_SOFT_ASKS = 2;

export function getVapidPublicKey(): string | null {
  const key = import.meta.env["VITE_VAPID_PUBLIC_KEY"];
  return typeof key === "string" && key.length > 0 ? key : null;
}

/** Trình duyệt này có hỗ trợ Web Push không. iOS: chỉ Safari 16.4+ và chỉ khi app đã thêm vào Màn hình chính. Chrome trên iPhone không hỗ trợ. */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  );
}

export function getPushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64url = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64url);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    console.error("service worker register failed", e);
    return null;
  }
}

async function getExistingSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export type SubscribeResult =
  | "subscribed"
  | "already"
  | "denied"
  | "unsupported"
  | "no-key"
  | "failed";

/** Đăng ký nhận push (gọi khi user đồng ý ở bước hỏi mềm). */
export async function subscribePush(): Promise<SubscribeResult> {
  if (!isPushSupported()) return "unsupported";
  const key = getVapidPublicKey();
  if (!key) return "no-key";
  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") return "denied";
  try {
    const reg = (await navigator.serviceWorker.ready) ?? (await registerServiceWorker());
    if (!reg) return "failed";
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await saveSubscription(existing);
      return "already";
    }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    await saveSubscription(sub);
    return "subscribed";
  } catch (e) {
    console.error("push subscribe failed", e);
    return "failed";
  }
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: json.keys?.["p256dh"] ?? "",
      auth: json.keys?.["auth"] ?? "",
      user_agent: navigator.userAgent,
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) throw error;
}

export async function unsubscribePush(): Promise<void> {
  try {
    const sub = await getExistingSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (e) {
    console.error("push unsubscribe failed", e);
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    return (await getExistingSubscription()) !== null;
  } catch {
    return false;
  }
}

/** Quyết định có hiện thẻ hỏi mềm không: tối đa 2 lần, mỗi lần cách nhau ít nhất 1 ngày. */
export function shouldShowSoftAsk(input: {
  permission: NotificationPermission | "unsupported";
  askedCount: number;
  lastAskedAt: number | null;
  now: number;
}): boolean {
  if (input.permission !== "default") return false;
  if (input.askedCount >= MAX_SOFT_ASKS) return false;
  if (input.lastAskedAt !== null && input.now - input.lastAskedAt < 24 * 3600 * 1000)
    return false;
  return true;
}

export function readSoftAskState(): { askedCount: number; lastAskedAt: number | null } {
  try {
    const raw = localStorage.getItem(SOFT_ASK_KEY);
    if (!raw) return { askedCount: 0, lastAskedAt: null };
    const parsed = JSON.parse(raw) as { askedCount?: unknown; lastAskedAt?: unknown };
    return {
      askedCount: typeof parsed.askedCount === "number" ? parsed.askedCount : 0,
      lastAskedAt: typeof parsed.lastAskedAt === "number" ? parsed.lastAskedAt : null,
    };
  } catch {
    return { askedCount: 0, lastAskedAt: null };
  }
}

export function recordSoftAsk(): void {
  const prev = readSoftAskState();
  try {
    localStorage.setItem(
      SOFT_ASK_KEY,
      JSON.stringify({ askedCount: prev.askedCount + 1, lastAskedAt: Date.now() }),
    );
  } catch {
    // Bỏ qua lỗi lưu local.
  }
}

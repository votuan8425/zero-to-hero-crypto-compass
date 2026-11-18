/**
 * Gửi Web Push phía server (chỉ chạy trong server function / job route).
 *
 * Luồng: trigger trong DB ghi 1 dòng vào `notifications` khi admin đăng hoặc
 * cập nhật danh mục (hoặc duyệt follow) -> job /api/public/jobs/send-push
 * (chạy mỗi phút qua Lovable cron) lấy các thông báo chưa gửi và đẩy tới
 * từng trình duyệt đã đăng ký của người nhận.
 *
 * VAPID: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT lấy từ Secrets
 * của Lovable. Thiếu key thì job bỏ qua (không lỗi) — thông báo trong app
 * vẫn hoạt động bình thường.
 */
import { sendNotification, setVapidDetails } from "web-push";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export function buildPushPayload(n: {
  id: string;
  title: string;
  body: string;
  link: string | null;
}): string {
  const payload: PushPayload = {
    title: n.title,
    body: n.body,
    url: n.link || "/tham-khao",
    tag: `zth-${n.id}`,
  };
  return JSON.stringify(payload);
}

function vapidDetails(): {
  subject: string;
  publicKey: string;
  privateKey: string;
} | null {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] || "mailto:yuntuan1309@gmail.com";
  if (!publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

export function isPushConfigured(): boolean {
  return vapidDetails() !== null;
}

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendToSubscription(
  sub: PushSubscriptionRow,
  payload: string,
): Promise<"sent" | "expired" | "failed"> {
  const details = vapidDetails();
  if (!details) return "failed";
  try {
    setVapidDetails(details.subject, details.publicKey, details.privateKey);
    await sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
    );
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: unknown })?.statusCode;
    if (status === 404 || status === 410) return "expired";
    console.error("web-push failed", e);
    return "failed";
  }
}

/**
 * Lấy các thông báo chưa gửi push và đẩy cho người nhận. Trả về số liệu để
 * job route ghi log. Thông báo quá 7 ngày thì bỏ qua (đánh dấu đã gửi để
 * khỏi kẹt hàng đợi). Hết đăng ký (410/404) thì xoá subscription đó.
 */
export async function deliverPendingPushNotifications(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = { processed: 0, sent: 0, failed: 0 };
  if (!isPushConfigured()) return result;

  const { data: pending, error } = await supabaseAdmin
    .from("notifications")
    .select("id, user_id, title, body, link, push_attempts, created_at")
    .is("push_sent_at", null)
    .lt("push_attempts", MAX_ATTEMPTS)
    .gt("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) throw error;
  if (!pending || pending.length === 0) return result;

  // Thông báo quá hạn (> 7 ngày) cũng đánh dấu để lần sau không lấy lại.
  const { data: stale } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .is("push_sent_at", null)
    .lt("push_attempts", MAX_ATTEMPTS)
    .lte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
    .limit(BATCH_SIZE);
  if (stale && stale.length > 0) {
    await supabaseAdmin
      .from("notifications")
      .update({ push_sent_at: new Date().toISOString() })
      .in(
        "id",
        stale.map((r) => r.id),
      );
  }

  for (const n of pending) {
    result.processed += 1;
    const payload = buildPushPayload(n);
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", n.user_id);
    if (!subs || subs.length === 0) {
      await supabaseAdmin
        .from("notifications")
        .update({ push_sent_at: new Date().toISOString() })
        .eq("id", n.id);
      continue;
    }
    let sent = false;
    let failed = false;
    for (const sub of subs as PushSubscriptionRow[]) {
      const outcome = await sendToSubscription(sub, payload);
      if (outcome === "sent") sent = true;
      if (outcome === "expired") {
        await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .eq("user_id", n.user_id)
          .eq("endpoint", sub.endpoint);
      }
      if (outcome === "failed") failed = true;
    }
    if (sent) {
      result.sent += 1;
      await supabaseAdmin
        .from("notifications")
        .update({ push_sent_at: new Date().toISOString() })
        .eq("id", n.id);
    } else if (failed) {
      result.failed += 1;
      await supabaseAdmin
        .from("notifications")
        .update({ push_attempts: (n.push_attempts ?? 0) + 1 })
        .eq("id", n.id);
    } else {
      // Chỉ còn đăng ký đã hết hạn (đã xoá): coi như đã xử lý.
      await supabaseAdmin
        .from("notifications")
        .update({ push_sent_at: new Date().toISOString() })
        .eq("id", n.id);
    }
  }
  return result;
}

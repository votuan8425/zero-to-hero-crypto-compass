/**
 * Thông báo trong app (bảng `notifications`): đọc, đếm chưa đọc, đánh dấu đã đọc.
 * Hàng được tạo phía server bằng trigger trong DB nên client chỉ đọc.
 */
import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | "allocation_updated"
  | "admin_message"
  | "follow_approved"
  | "follow_requested";

export interface AppNotification {
  id: string;
  user_id: string;
  investor_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
}

export const NOTIFICATIONS_QUERY_KEY = ["notifications", "list"] as const;
export const UNREAD_COUNT_QUERY_KEY = ["notifications", "unread-count"] as const;

export async function fetchNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, investor_id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}

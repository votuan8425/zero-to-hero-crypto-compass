/**
 * Theo dõi nhà đầu tư có duyệt (tab Tham khảo).
 *
 * Người dùng gửi yêu cầu theo dõi một nhà đầu tư (admin); admin duyệt thì
 * mới được xem biểu đồ danh mục. Trước khi duyệt, chỉ thấy tên + thống kê
 * chung, KHÔNG thấy chart. Bảng `investor_follows` (migration 0006).
 */
import { supabase } from "@/integrations/supabase/client";

export type FollowStatus = "pending" | "approved" | "rejected";

export interface InvestorFollow {
  id: string;
  investor_id: string;
  follower_id: string;
  /** Tên hiển thị của người gửi (để admin biết ai đang xin theo dõi). */
  follower_name: string | null;
  status: FollowStatus;
  created_at: string;
  updated_at: string;
}

/** Trạng thái theo dõi của user hiện tại đối với một nhà đầu tư (null = chưa gửi).
 * Chỉ tính yêu cầu do chính mình gửi (follower_id = mình) — không tính yêu
 * cầu người khác gửi tới mình (investor_id = mình) vì cùng investor_id. */
export async function fetchMyFollowStatus(
  investorId: string,
): Promise<FollowStatus | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("investor_follows")
    .select("status")
    .eq("investor_id", investorId)
    .eq("follower_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  const s = (data as { status?: unknown }).status;
  return s === "approved" || s === "pending" || s === "rejected" ? s : null;
}

/** Tất cả trạng thái theo dõi của user hiện tại (map investor_id -> status).
 * Chỉ các yêu cầu do chính mình gửi — không lấy yêu cầu người khác gửi tới
 * mình (vì cùng investor_id sẽ làm thẻ của chính mình hiện sai trạng thái). */
export async function fetchMyFollowMap(): Promise<Record<string, FollowStatus>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};
  const { data, error } = await supabase
    .from("investor_follows")
    .select("investor_id, status")
    .eq("follower_id", user.id);
  if (error || !data) return {};
  const map: Record<string, FollowStatus> = {};
  for (const row of data as { investor_id?: unknown; status?: unknown }[]) {
    const inv = typeof row.investor_id === "string" ? row.investor_id : "";
    const s = row.status;
    if (inv && (s === "approved" || s === "pending" || s === "rejected")) {
      map[inv] = s;
    }
  }
  return map;
}

/** Gửi yêu cầu theo dõi (hoặc gửi lại sau khi bị từ chối).
 * Luôn gửi ở trạng thái 'pending' — RLS bắt buộc người theo dõi chỉ được
 * tạo yêu cầu chờ duyệt, không được tự đặt 'approved' (kể cả admin tự
 * theo dõi mình cũng gửi 'pending' rồi tự duyệt ở bảng cuối trang). */
export async function requestFollow(investorId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Bạn cần đăng nhập để gửi yêu cầu theo dõi.");
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const followerName =
    (typeof meta["display_name"] === "string" && meta["display_name"]) ||
    (typeof meta["username"] === "string" && meta["username"]) ||
    (typeof user.email === "string" ? user.email.split("@")[0] : "") ||
    null;
  const { error } = await supabase.from("investor_follows").upsert(
    {
      investor_id: investorId,
      follower_id: user.id,
      follower_name: followerName,
      status: "pending",
    },
    { onConflict: "investor_id,follower_id" },
  );
  if (error) throw error;
}

/** Hủy yêu cầu theo dõi của mình (hoặc gỡ theo dõi). */
export async function cancelFollow(investorId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("investor_follows")
    .delete()
    .eq("investor_id", investorId)
    .eq("follower_id", user.id);
  if (error) throw error;
}

/** Yêu cầu đang chờ duyệt gửi tới nhà đầu tư (dành cho admin xem + duyệt). */
export async function fetchPendingFollowRequests(
  investorId: string,
): Promise<InvestorFollow[]> {
  const { data, error } = await supabase
    .from("investor_follows")
    .select("id, investor_id, follower_id, follower_name, status, created_at, updated_at")
    .eq("investor_id", investorId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as InvestorFollow[]).filter((r) => r.status === "pending");
}

/** Admin duyệt hoặc từ chối một yêu cầu theo dõi. */
export async function reviewFollowRequest(
  requestId: string,
  decision: "approved" | "rejected",
): Promise<void> {
  const { error } = await supabase
    .from("investor_follows")
    .update({ status: decision })
    .eq("id", requestId);
  if (error) throw error;
}

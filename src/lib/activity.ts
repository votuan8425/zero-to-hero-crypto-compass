import { supabase } from "@/integrations/supabase/client";
import { displaySymbol } from "./coins";
import { formatPercent } from "./format";

/**
 * Nhật ký hành động của admin cho tab Tham khảo. Chỉ lưu % và tên token —
 * KHÔNG lưu số lượng, số tiền hay giá mua — nên người theo dõi đã duyệt
 * mới xem được mà không lộ thông tin riêng tư.
 */

export type ActivityType = "buy" | "sell" | "swap" | "update" | "message";

export interface Activity {
  id: string;
  user_id: string;
  type: ActivityType;
  /** Token nguồn (mua / bán / đổi). */
  symbol: string | null;
  /** Token đích (bán sang USDT, đổi sang token khác). */
  to_symbol: string | null;
  /** % so với số lượng đang nắm trước giao dịch (null khi mua lần đầu). */
  pct: number | null;
  /** Ảnh chụp phân bổ mới sau khi cập nhật portfolio. */
  meta: { allocation?: string } | null;
  created_at: string;
}

/** Nhãn cột "Hành động". Mua lần đầu ghi "Mua", mua thêm mới ghi "Mua thêm". */
export function activityLabel(a: Pick<Activity, "type" | "pct">): string {
  switch (a.type) {
    case "buy":
      return a.pct == null ? "Mua" : "Mua thêm";
    case "sell":
      return "Bán";
    case "swap":
      return "Đổi";
    case "update":
      return "Cập nhật portfolio";
    case "message":
      return "Đổi lời nhắn";
  }
}

/**
 * Câu mô tả ngắn gọn cho cột "Chi tiết" — chỉ % và tên token, không số
 * lượng hay số tiền. Ví dụ: "50% BTC", "100% BTC sang ETH",
 * "100% BTC sang USDT", "ETH 81% · BTC 19%".
 */
export function activityDetail(
  a: Pick<Activity, "type" | "symbol" | "to_symbol" | "pct" | "meta">,
): string {
  const s = a.symbol ? displaySymbol(a.symbol) : "";
  const to = a.to_symbol ? displaySymbol(a.to_symbol) : "";
  const pct = a.pct != null ? formatPercent(a.pct, 1) : null;
  switch (a.type) {
    case "buy":
      return pct ? `${pct} ${s}` : s;
    case "sell":
    case "swap":
      return pct ? `${pct} ${s} sang ${to}` : `${s} sang ${to}`;
    case "update":
      return a.meta?.allocation ?? "—";
    case "message":
      return "—";
  }
}

/** Tóm tắt phân bổ thành chuỗi ngắn: "ETH 81% · BTC 19%" (làm tròn %). */
export function allocationSummary(slices: { symbol: string; percent: number }[]): string {
  return slices.map((s) => `${displaySymbol(s.symbol)} ${formatPercent(s.percent, 0)}`).join(" · ");
}

export interface LogActivityInput {
  userId: string;
  type: ActivityType;
  symbol?: string | null;
  toSymbol?: string | null;
  pct?: number | null;
  meta?: { allocation?: string } | null;
}

/**
 * Ghi một hành động. Fire-and-forget: nếu bảng chưa có (Lovable chưa chạy
 * migration) thì chỉ cảnh báo, không làm hỏng luồng mua/bán/đổi chính.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const { error } = await supabase.from("admin_activities").insert({
      user_id: input.userId,
      type: input.type,
      symbol: input.symbol ?? null,
      to_symbol: input.toSymbol ?? null,
      pct: input.pct ?? null,
      // Cột meta bắt buộc (mặc định {}), gửi null sẽ bị database từ chối.
      meta: input.meta ?? {},
    });
    if (error) console.warn("[activity] log failed", error.message);
  } catch (err) {
    console.warn("[activity] log failed", err);
  }
}

/** Đọc N hành động gần nhất của một investor (mặc định 3). Lỗi thì trả rỗng. */
export async function fetchRecentActivities(userId: string, limit = 3): Promise<Activity[]> {
  try {
    const { data, error } = await supabase
      .from("admin_activities")
      .select("id,user_id,type,symbol,to_symbol,pct,meta,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as unknown as Activity[];
  } catch {
    return [];
  }
}

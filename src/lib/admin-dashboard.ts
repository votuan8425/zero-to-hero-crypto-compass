/**
 * Dashboard quản trị (chỉ admin yuntuan1309@gmail.com).
 *
 * Admin KHÔNG đọc trực tiếp dữ liệu người khác qua RLS — mọi thao tác đều
 * qua 3 hàm SECURITY DEFINER ở migration 0008, mỗi hàm tự kiểm tra người
 * gọi có phải admin không:
 * - admin_list_users(): danh sách tài khoản + số liệu gộp từ giao dịch.
 * - admin_update_user(): sửa tên hiển thị / tiền tệ của một tài khoản.
 * - admin_delete_user(): xóa hẳn một tài khoản (giao dịch, theo dõi,
 *   thông báo, hồ sơ, tài khoản đăng nhập).
 *
 * Giá trị hiện tại và % nắm giữ tính ở client từ holdings gộp + giá live
 * (hàm computeAdminUserStats), giống cách Trang chủ tính từ giao dịch.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { coinName, normalizeSymbol } from "./coins";
import { normalizeCurrency, type Currency } from "./format";
import type { PriceMap } from "./portfolio";

export interface AdminHolding {
  symbol: string;
  coin_name: string;
  quantity: number;
  invested_usd: number;
  /** Vốn VND chính xác — chỉ có với vàng/bạc, coin thường là null. */
  invested_vnd: number | null;
}

export interface AdminUserRow {
  user_id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  currency: Currency;
  created_at: string;
  last_sign_in_at: string | null;
  tx_count: number;
  invested_usd: number;
  holdings: AdminHolding[];
}

export interface AdminUserSlice {
  symbol: string;
  name: string;
  percent: number;
}

export interface AdminUserStats {
  investedUsd: number;
  /** null khi có đồng chưa có giá live (vàng/bạc lấy qua server). */
  valueUsd: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  slices: AdminUserSlice[];
  basis: "value" | "cost";
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** Định giá một tài khoản từ số liệu gộp + giá live, tính theo USDT. */
export function computeAdminUserStats(
  holdings: AdminHolding[],
  prices: PriceMap,
  usdVnd: number | null,
): AdminUserStats {
  const investedUsd = holdings.reduce((s, h) => s + h.invested_usd, 0);
  // Giá trị từng đồng: coin dùng giá USD; vàng/bạc không có giá USD nên
  // quy từ giá VND (bid SJC/Ancarat) qua tỷ giá USD→VND.
  const values = holdings.map((h) => {
    const q = prices[normalizeSymbol(h.symbol)];
    if (q && q.usd > 0) return h.quantity * q.usd;
    if (q && q.vnd > 0 && usdVnd && usdVnd > 0) return (h.quantity * q.vnd) / usdVnd;
    return null;
  });
  const useValue = holdings.length > 0 && values.every((v) => v != null);
  const valueUsd = useValue ? values.reduce((s, v) => s + (v ?? 0), 0) : null;
  const pnlUsd = valueUsd != null ? valueUsd - investedUsd : null;
  const pnlPct = pnlUsd != null && investedUsd > 0 ? (pnlUsd / investedUsd) * 100 : null;
  const amount = (h: AdminHolding, i: number) =>
    useValue ? (values[i] ?? 0) : h.invested_usd;
  const total = holdings.reduce((s, h, i) => s + amount(h, i), 0);
  const slices =
    total > 0
      ? holdings
          .map((h, i) => ({
            symbol: normalizeSymbol(h.symbol),
            name: coinName(normalizeSymbol(h.symbol), h.coin_name),
            percent: (amount(h, i) / total) * 100,
          }))
          .sort((a, b) => b.percent - a.percent)
      : [];
  return { investedUsd, valueUsd, pnlUsd, pnlPct, slices, basis: useValue ? "value" : "cost" };
}

/** Đọc + chuẩn hóa kết quả admin_list_users (phòng khi server trả sai kiểu). */
export function parseAdminUsers(rows: unknown): AdminUserRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => {
      const rawHoldings = Array.isArray(r["holdings"]) ? r["holdings"] : [];
      const holdings: AdminHolding[] = rawHoldings
        .filter((h): h is Record<string, unknown> => typeof h === "object" && h !== null)
        .map((h) => {
          const vnd = h["invested_vnd"] == null ? null : num(h["invested_vnd"], NaN);
          return {
            symbol: normalizeSymbol(typeof h["symbol"] === "string" ? h["symbol"] : ""),
            coin_name: typeof h["coin_name"] === "string" ? h["coin_name"] : "",
            quantity: num(h["quantity"]),
            invested_usd: num(h["invested_usd"]),
            invested_vnd: vnd != null && Number.isFinite(vnd) ? vnd : null,
          };
        })
        .filter((h) => h["symbol"] !== "")
        .sort((a, b) => b.invested_usd - a.invested_usd);
      return {
        user_id: typeof r["user_id"] === "string" ? r["user_id"] : "",
        email: typeof r["email"] === "string" ? r["email"] : null,
        username: typeof r["username"] === "string" ? r["username"] : null,
        display_name: typeof r["display_name"] === "string" ? r["display_name"] : null,
        currency: normalizeCurrency(typeof r["currency"] === "string" ? r["currency"] : null),
        created_at: typeof r["created_at"] === "string" ? r["created_at"] : "",
        last_sign_in_at: typeof r["last_sign_in_at"] === "string" ? r["last_sign_in_at"] : null,
        tx_count: num(r["tx_count"]),
        invested_usd: num(r["invested_usd"]),
        holdings,
      };
    })
    .filter((u) => u.user_id !== "");
}

/** Danh sách tài khoản (chỉ admin gọi được — server tự kiểm tra quyền). */
export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw error;
  return parseAdminUsers(data);
}

export const adminUsersKey = ["admin", "users"] as const;

export const adminUsersQuery = queryOptions({
  queryKey: adminUsersKey,
  queryFn: fetchAdminUsers,
  staleTime: 30_000,
});

/** Sửa tên hiển thị / tiền tệ của một tài khoản. */
export async function adminUpdateUser(
  targetId: string,
  patch: { display_name: string | null; currency: Currency },
): Promise<void> {
  const { error } = await supabase.rpc("admin_update_user", {
    p_target: targetId,
    p_display_name: patch.display_name ?? "",
    p_currency: patch.currency,
  });
  if (error) throw error;
}

/** Xóa hẳn một tài khoản (không xóa được chính mình / tài khoản admin). */
export async function adminDeleteUser(targetId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_user", { p_target: targetId });
  if (error) throw error;
}

/**
 * The admin's public allocation (Tham khảo).
 *
 * Only the admin writes this row; the full row is readable only by the
 * admin and approved followers (others only see that it exists). The
 * payload is PERCENT-ONLY: { symbol, name, percent }. Quantities,
 * values, invested amounts, notes and images are never stored here and
 * never leave the admin's own portfolio. The row also stores two public
 * stats: the accumulation start date and the current P/L % vs capital
 * (both percentages/dates — never money amounts).
 */
import { supabase } from "@/integrations/supabase/client";
import type { AllocationSlice } from "./portfolio";
import { isAdminUser } from "./admin";
import type { User } from "@supabase/supabase-js";

export interface AdminAllocationSlice {
  symbol: string;
  name: string;
  percent: number;
}

/** Số liệu công khai kèm theo portfolio đã đăng — chỉ % và thời gian, không số tiền. */
export interface AdminAllocationStats {
  /** Ngày mua đầu tiên của admin (YYYY-MM-DD) — dùng để tính "đã tích lũy bao lâu". */
  startedAt: string | null;
  /** Lãi/lỗ hiện tại theo % vốn đã bỏ ra (có thể âm). */
  pnlPct: number | null;
}

export interface AdminAllocation {
  user_id: string;
  slices: AdminAllocationSlice[];
  updated_at: string;
  startedAt: string | null;
  pnlPct: number | null;
  /** Lời nhắn của nhà đầu tư (tab Tham khảo) — chỉ text, không số tiền. */
  message: string | null;
  /** Lúc lời nhắn được cập nhật lần cuối. */
  messageUpdatedAt: string | null;
}

export const adminAllocationKey = ["admin-allocation"] as const;

/** Query key cho danh sách nhà đầu tư đã đăng (tab Tham khảo). */
export const publishedAllocationsKey = ["published-allocations"] as const;

/** Key lưu nhà đầu tư đang theo dõi trên thiết bị này. */
export const FOLLOWED_INVESTOR_KEY = "zth:followed-investor";

/** Id nhà đầu tư đang theo dõi (đã lưu trên thiết bị), null nếu chưa theo dõi ai. */
export function readFollowedInvestorId(): string | null {
  try {
    return localStorage.getItem(FOLLOWED_INVESTOR_KEY) || null;
  } catch {
    return null;
  }
}

/** Lưu / gỡ nhà đầu tư đang theo dõi. */
export function saveFollowedInvestorId(id: string | null): void {
  try {
    if (id) localStorage.setItem(FOLLOWED_INVESTOR_KEY, id);
    else localStorage.removeItem(FOLLOWED_INVESTOR_KEY);
  } catch {
    /* bỏ qua */
  }
}

/**
 * Chọn nhà đầu tư để xem: người đang theo dõi nếu còn trong danh sách,
 * không thì người đầu tiên (mới cập nhật nhất), không có ai thì null.
 */
export function selectPublishedAllocation(
  investors: AdminAllocation[],
  followedId: string | null,
): AdminAllocation | null {
  if (investors.length === 0) return null;
  const followed = followedId
    ? investors.find((a) => a.user_id === followedId)
    : undefined;
  return followed ?? investors[0];
}

/**
 * Builds the percent-only payload from an allocation. Extra fields on the
 * input (quantity, value, invested, ...) are dropped by construction:
 * only symbol / name / percent are copied, percentages are rounded to
 * 2 decimals and zero/negative slices are removed.
 */
export function buildAdminAllocationSlices(
  slices: readonly AllocationSlice[],
): AdminAllocationSlice[] {
  return slices
    .map((s) => ({
      symbol: s.symbol,
      name: s.name,
      percent: Math.round(s.percent * 100) / 100,
    }))
    .filter((s) => s.symbol && Number.isFinite(s.percent) && s.percent > 0)
    .sort((a, b) => b.percent - a.percent);
}

/** True when two payloads differ by more than 0.01 on any slice. */
export function allocationChanged(
  prev: readonly AdminAllocationSlice[] | null | undefined,
  next: readonly AdminAllocationSlice[],
): boolean {
  const a = prev ?? [];
  if (a.length !== next.length) return true;
  const bySymbol = new Map(a.map((s) => [s.symbol, s.percent]));
  return next.some((s) => {
    const p = bySymbol.get(s.symbol);
    return p === undefined || Math.abs(p - s.percent) > 0.01;
  });
}

/** True khi số liệu công bố thay đổi (ngày bắt đầu khác, hoặc lãi/lỗ lệch > 0.01). */
export function statsChanged(
  prev: AdminAllocationStats | null | undefined,
  next: AdminAllocationStats,
): boolean {
  const a = prev ?? { startedAt: null, pnlPct: null };
  if ((a.startedAt ?? null) !== (next.startedAt ?? null)) return true;
  const p = a.pnlPct ?? null;
  const n = next.pnlPct ?? null;
  if (p === null || n === null) return p !== n;
  return Math.abs(p - n) > 0.01;
}

/** True khi lời nhắn thay đổi (so sánh sau khi trim; null và "" coi như nhau). */
export function messageChanged(
  prev: string | null | undefined,
  next: string | null | undefined,
): boolean {
  return (prev ?? "").trim() !== (next ?? "").trim();
}

type AdminAllocationRow = {
  user_id: string;
  slices: unknown;
  updated_at: string;
  started_at?: string | null;
  pnl_pct?: number | string | null;
  message?: string | null;
  message_updated_at?: string | null;
};

function parseRow(row: AdminAllocationRow): AdminAllocation {
  const pnl =
    row.pnl_pct == null || row.pnl_pct === "" ? null : Number(row.pnl_pct);
  const message = (row.message ?? "").trim();
  return {
    user_id: row.user_id,
    slices: parseSlices(row.slices),
    updated_at: row.updated_at,
    startedAt: row.started_at ?? null,
    pnlPct: Number.isFinite(pnl) ? pnl : null,
    message: message ? row.message : null,
    messageUpdatedAt: row.message_updated_at ?? null,
  };
}

function parseSlices(raw: unknown): AdminAllocationSlice[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is { symbol: unknown; name: unknown; percent: unknown } =>
        typeof s === "object" && s !== null,
    )
    .map((s) => ({
      symbol: String(s.symbol ?? ""),
      name: String(s.name ?? ""),
      percent: Number(s.percent ?? 0),
    }))
    .filter((s) => s.symbol && Number.isFinite(s.percent) && s.percent > 0);
}

/**
 * Reads the single admin allocation row. Returns null when there is none
 * yet — including when the admin_allocations table does not exist yet
 * (migration 0002 not applied); the UI shows an empty state instead of
 * crashing. When migration 0003 (started_at / pnl_pct) or 0005 (message)
 * has not been applied yet, the read falls back to narrower columns and
 * the missing values simply show as unavailable.
 */
export async function fetchAdminAllocation(): Promise<AdminAllocation | null> {
  const selects = [
    "user_id, slices, updated_at, started_at, pnl_pct, message, message_updated_at",
    "user_id, slices, updated_at, started_at, pnl_pct",
    "user_id, slices, updated_at",
  ];
  for (const columns of selects) {
    try {
      const { data, error } = await supabase
        .from("admin_allocations")
        .select(columns)
        .limit(1)
        .maybeSingle();
      if (!error) {
        const row = data as AdminAllocationRow | null;
        return row ? parseRow(row) : null;
      }
    } catch {
      // Thử với ít cột hơn (migration chưa áp dụng).
    }
  }
  return null;
}

/**
 * Reads every published allocation — danh sách nhà đầu tư đã đăng để user
 * chọn và theo dõi (tab Tham khảo). Chỉ admin mới ghi được (RLS).
 *
 * Quyền đọc do backend quyết định: hàm `list_published_investors` chỉ trả
 * về ai đã đăng + lúc cập nhật (để hiện thẻ khóa và nút theo dõi); toàn bộ
 * tỷ lệ %, lãi/lỗ và lời nhắn chỉ đọc được bởi chính nhà đầu tư hoặc người
 * đã được duyệt theo dõi. Hàng chưa được xem thì trả về với dữ liệu rỗng.
 * Trả về [] khi bảng chưa có, để UI hiện trạng thái trống.
 */
export async function fetchPublishedAllocations(): Promise<AdminAllocation[]> {
  let listed: { user_id: string; updated_at: string }[] = [];
  try {
    const { data, error } = await supabase.rpc("list_published_investors");
    if (!error && Array.isArray(data)) {
      listed = data as { user_id: string; updated_at: string }[];
    }
  } catch {
    // Bỏ qua — vẫn thử đọc các hàng được phép xem bên dưới.
  }

  const selects = [
    "user_id, slices, updated_at, started_at, pnl_pct, message, message_updated_at",
    "user_id, slices, updated_at, started_at, pnl_pct",
    "user_id, slices, updated_at",
  ];
  let visible: AdminAllocation[] = [];
  for (const columns of selects) {
    try {
      const { data, error } = await supabase
        .from("admin_allocations")
        .select(columns)
        .order("updated_at", { ascending: false });
      if (!error) {
        visible = ((data ?? []) as unknown as AdminAllocationRow[]).map(parseRow);
        break;
      }
    } catch {
      // Thử với ít cột hơn (migration chưa áp dụng).
    }
  }

  const byId = new Map(visible.map((a) => [a.user_id, a]));
  const merged: AdminAllocation[] = listed.map(
    (row) =>
      byId.get(row.user_id) ?? {
        user_id: row.user_id,
        slices: [],
        updated_at: row.updated_at,
        startedAt: null,
        pnlPct: null,
        message: null,
        messageUpdatedAt: null,
      },
  );
  for (const a of visible) {
    if (!listed.some((r) => r.user_id === a.user_id)) merged.push(a);
  }
  return merged.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

/**
 * Syncs the admin's current portfolio allocation (percent-only) to the
 * shared row, plus the public stats (accumulation start date + P/L %).
 * No-op for non-admin users and for empty allocations. Only writes when
 * the payload actually changed. When migration 0003 has not been applied
 * yet, the stats are dropped and only the slices are written.
 *
 * `message` is optional: pass `undefined` (default) to leave the stored
 * investor message untouched (this is what the automatic sync does);
 * pass a string (empty string clears it) to set it together with the
 * portfolio. Throws a clear error when the message column does not
 * exist yet (migration 0005 not applied).
 */
export async function syncAdminAllocation(
  user: User,
  allocation: { slices: AllocationSlice[] },
  stats: AdminAllocationStats = { startedAt: null, pnlPct: null },
  message?: string | null,
): Promise<"synced" | "unchanged" | "skipped"> {
  if (!isAdminUser(user)) return "skipped";
  const slices = buildAdminAllocationSlices(allocation.slices);
  if (slices.length === 0) return "skipped";
  const normalizedMessage =
    message === undefined ? undefined : message.trim() ? message.trim() : null;
  const existing = await fetchAdminAllocation();
  if (
    existing &&
    existing.user_id === user.id &&
    !allocationChanged(existing.slices, slices) &&
    !statsChanged(existing, stats) &&
    (normalizedMessage === undefined || !messageChanged(existing.message, normalizedMessage))
  ) {
    return "unchanged";
  }
  const payload: Record<string, unknown> = {
    user_id: user.id,
    slices,
    started_at: stats.startedAt,
    pnl_pct: stats.pnlPct,
  };
  if (normalizedMessage !== undefined) {
    payload.message = normalizedMessage;
    payload.message_updated_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("admin_allocations")
    .upsert(payload, { onConflict: "user_id" });
  if (error) {
    // Cột message chưa có (chưa chạy migration 0005) và đang lưu lời nhắn.
    if (isMissingMessageColumn(error)) {
      throw new Error(
        "Chưa chạy migration 0005 — hãy chạy drizzle/migrations/0005_admin_message.sql trong Supabase SQL editor rồi lưu lại.",
      );
    }
    // Cột stats chưa có: ghi lại chỉ với slices (+ lời nhắn nếu có).
    const retry: Record<string, unknown> = { user_id: user.id, slices };
    if (normalizedMessage !== undefined) {
      retry.message = normalizedMessage;
      retry.message_updated_at = new Date().toISOString();
    }
    const fallback = await supabase
      .from("admin_allocations")
      .upsert(retry, { onConflict: "user_id" });
    if (fallback.error) {
      if (isMissingMessageColumn(fallback.error)) {
        throw new Error(
          "Chưa chạy migration 0005 — hãy chạy drizzle/migrations/0005_admin_message.sql trong Supabase SQL editor rồi lưu lại.",
        );
      }
      throw fallback.error;
    }
    return "synced";
  }
  return "synced";
}

/** True khi lỗi là "cột message chưa tồn tại" (Postgres 42703). */
function isMissingMessageColumn(error: { code?: string; message?: string }): boolean {
  return error.code === "42703" && /message/i.test(error.message ?? "");
}

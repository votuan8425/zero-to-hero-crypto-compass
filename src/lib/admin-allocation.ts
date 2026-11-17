/**
 * The admin's public allocation (Tham khảo).
 *
 * Only the admin writes this row; every logged-in user reads it. The
 * payload is PERCENT-ONLY: { symbol, name, percent }. Quantities,
 * values, invested amounts, dates, notes and images are never stored
 * here and never leave the admin's own portfolio.
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

export interface AdminAllocation {
  user_id: string;
  slices: AdminAllocationSlice[];
  updated_at: string;
}

export const adminAllocationKey = ["admin-allocation"] as const;

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

type AdminAllocationRow = {
  user_id: string;
  slices: unknown;
  updated_at: string;
};

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
 * crashing.
 */
export async function fetchAdminAllocation(): Promise<AdminAllocation | null> {
  try {
    const { data, error } = await supabase
      .from("admin_allocations")
      .select("user_id, slices, updated_at")
      .limit(1)
      .maybeSingle();
    if (error) return null;
    const row = data as AdminAllocationRow | null;
    if (!row) return null;
    return { user_id: row.user_id, slices: parseSlices(row.slices), updated_at: row.updated_at };
  } catch {
    return null;
  }
}

/**
 * Syncs the admin's current portfolio allocation (percent-only) to the
 * shared row. No-op for non-admin users and for empty allocations.
 * Only writes when the payload actually changed.
 */
export async function syncAdminAllocation(
  user: User,
  allocation: { slices: AllocationSlice[] },
): Promise<"synced" | "unchanged" | "skipped"> {
  if (!isAdminUser(user)) return "skipped";
  const slices = buildAdminAllocationSlices(allocation.slices);
  if (slices.length === 0) return "skipped";
  const existing = await fetchAdminAllocation();
  if (existing && existing.user_id === user.id && !allocationChanged(existing.slices, slices)) {
    return "unchanged";
  }
  const { error } = await supabase
    .from("admin_allocations")
    .upsert({ user_id: user.id, slices }, { onConflict: "user_id" });
  if (error) throw error;
  return "synced";
}

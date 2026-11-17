import { parseDateOnly, toDateKey } from "./format";
import type { Tx } from "./portfolio";

export interface MonthGroup {
  /** YYYY-MM. */
  key: string;
  year: number;
  month: number; // 1-12
  txs: Tx[];
  buys: number;
  investedUsd: number;
}

export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthKeyOfTx(t: Tx): string {
  return monthKeyOf(parseDateOnly(t.tx_date));
}

/** Nhóm giao dịch theo tháng (mới nhất trước); trong tháng xếp theo ngày giảm dần. */
export function groupByMonth(txs: readonly Tx[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const t of txs) {
    const d = parseDateOnly(t.tx_date);
    const key = monthKeyOf(d);
    const g = map.get(key) ?? {
      key,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      txs: [],
      buys: 0,
      investedUsd: 0,
    };
    g.txs.push(t);
    g.buys += 1;
    g.investedUsd += Number(t.quantity) * Number(t.price_usd) + Number(t.fee_usd || 0);
    map.set(key, g);
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.txs.sort((a, b) => (a.tx_date < b.tx_date ? 1 : a.tx_date > b.tx_date ? -1 : 0));
  }
  groups.sort((a, b) => (a.key < b.key ? 1 : -1));
  return groups;
}

/** "Tháng 11/2026" — tiêu đề tháng, viết hoa chữ đầu theo tiếng Việt. */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const name = new Intl.DateTimeFormat("vi-VN", { month: "long" }).format(
    new Date(y, m - 1, 1),
  );
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

/** Tổng vốn + số lần mua của một năm (từ các nhóm tháng). */
export function yearTotals(groups: readonly MonthGroup[], year: number): {
  buys: number;
  investedUsd: number;
} {
  let buys = 0;
  let investedUsd = 0;
  for (const g of groups) {
    if (g.year !== year) continue;
    buys += g.buys;
    investedUsd += g.investedUsd;
  }
  return { buys, investedUsd };
}

/** Ngày giao dịch đầu tiên (YYYY-MM-DD) hoặc null khi chưa có giao dịch. */
export function earliestTxDate(txs: readonly Tx[]): string | null {
  if (txs.length === 0) return null;
  let min = txs[0]?.tx_date ?? "";
  for (const t of txs) if (t.tx_date < min) min = t.tx_date;
  return min || null;
}

/**
 * "Đã tích lũy được bao lâu" từ ngày bắt đầu tới hôm nay:
 * "1 năm 3 tháng", "8 tháng", "12 ngày", "Hôm nay".
 */
export function formatDurationSince(startDate: string, now: Date = new Date()): string {
  const start = parseDateOnly(startDate);
  if (Number.isNaN(start.getTime())) return "—";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  if (s > today) return "Hôm nay";
  let years = today.getFullYear() - s.getFullYear();
  let months = today.getMonth() - s.getMonth();
  if (today.getDate() < s.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years > 0) return months > 0 ? `${years} năm ${months} tháng` : `${years} năm`;
  if (months > 0) return `${months} tháng`;
  const days = Math.round((today.getTime() - s.getTime()) / 86_400_000);
  return days <= 0 ? "Hôm nay" : `${days} ngày`;
}

/** Khóa ngày hôm nay (YYYY-MM-DD), dùng cho so sánh nhanh. */
export function todayKeyLocal(): string {
  return toDateKey(new Date());
}

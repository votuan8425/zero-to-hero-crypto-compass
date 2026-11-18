/**
 * Lịch sử giá trị danh mục theo thời gian — dữ liệu cho biểu đồ xu hướng
 * tài sản kiểu OKX ở trang chủ.
 *
 * Cách tính: với mỗi mốc thời gian có giá đóng cửa, giá trị = tổng số lượng
 * đã mua tới mốc đó × giá đóng cửa gần nhất tại hoặc trước mốc đó.
 * Chỉ tính lần mua (app không có bán), nên số lượng chỉ tăng theo thời gian.
 * Giá trị tính bằng USD; hiển thị quy đổi theo tiền tệ người dùng chọn ở
 * tầng giao diện (giống tổng giá trị hiện tại).
 */

import type { Tx } from "./portfolio";

export interface HistoryPoint {
  /** Epoch ms. */
  t: number;
  /** Tổng giá trị danh mục lúc đó, USD. */
  value: number;
}

export interface PortfolioHistory {
  points: HistoryPoint[];
  startValue: number;
  endValue: number;
  pnl: number;
  pnlPct: number | null;
}

const DAY_MS = 86_400_000;

export const HISTORY_PERIODS = ["1W", "1M", "3M", "1Y"] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

/** Số ngày mỗi kỳ xem: 1W→7, 1M→30, 3M→90, 1Y→365. */
export function historyPeriodDays(period: HistoryPeriod): number {
  return period === "1W" ? 7 : period === "1M" ? 30 : period === "3M" ? 90 : 365;
}

/** Nhãn tiếng Việt cho dòng PNL theo kỳ ("PNL trong 1 tháng …"). */
export function historyPeriodLabel(period: HistoryPeriod): string {
  return period === "1W"
    ? "1 tuần"
    : period === "1M"
      ? "1 tháng"
      : period === "3M"
        ? "3 tháng"
        : "1 năm";
}

/** "2026-11-18" → ms lúc 00:00 UTC ngày đó. */
export function txDateMs(txDate: string): number {
  const [y, m, d] = txDate.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Giá đóng cửa gần nhất tại hoặc trước thời điểm t (chuỗi đã sắp theo t). */
function priceAt(series: { t: number; c: number }[], t: number): number | null {
  let lo = 0;
  let hi = series.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid]!.t <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? series[ans]!.c : null;
}

const EMPTY: PortfolioHistory = {
  points: [],
  startValue: 0,
  endValue: 0,
  pnl: 0,
  pnlPct: null,
};

export function computePortfolioHistory(
  txs: Tx[],
  closesBySymbol: Record<string, { t: number; c: number }[]>,
  fromMs: number,
  toMs: number,
): PortfolioHistory {
  if (txs.length === 0) return EMPTY;
  // Tất cả mốc thời gian có giá trong khoảng (hợp các symbol — lưới nến
  // CoinGecko có thể lệch nhau vài giờ giữa các coin nên không ép cùng mốc).
  const times = new Set<number>();
  for (const s of Object.values(closesBySymbol)) {
    for (const p of s) if (p.t >= fromMs && p.t <= toMs) times.add(p.t);
  }
  const sorted = [...times].sort((a, b) => a - b);
  if (sorted.length === 0) return EMPTY;
  const buys = txs
    .map((t) => ({ symbol: t.symbol, at: txDateMs(t.tx_date), qty: t.quantity }))
    .filter((b) => Number.isFinite(b.qty) && b.qty > 0)
    .sort((a, b) => a.at - b.at);
  if (buys.length === 0) return EMPTY;
  const points: HistoryPoint[] = [];
  for (const t of sorted) {
    let value = 0;
    for (const [symbol, series] of Object.entries(closesBySymbol)) {
      const price = priceAt(series, t);
      if (price == null || price <= 0) continue;
      let qty = 0;
      for (const b of buys) {
        if (b.symbol !== symbol) continue;
        if (b.at > t) break;
        qty += b.qty;
      }
      if (qty > 0) value += qty * price;
    }
    if (value > 0) points.push({ t, value });
  }
  // Bỏ đoạn đầu chưa có tài sản để đường bắt đầu từ lần mua đầu tiên.
  let first = 0;
  while (first < points.length && points[first]!.value <= 0) first++;
  const trimmed = points.slice(first);
  if (trimmed.length === 0) return EMPTY;
  const startValue = trimmed[0]!.value;
  const endValue = trimmed[trimmed.length - 1]!.value;
  return {
    points: trimmed,
    startValue,
    endValue,
    pnl: endValue - startValue,
    pnlPct: startValue > 0 ? ((endValue - startValue) / startValue) * 100 : null,
  };
}

/**
 * Chốt điểm cuối bằng tổng giá trị hiện tại (giá live) để đường chạm đúng
 * số đang hiện: nếu điểm cuối đã cũ hơn 1 giờ thì thêm điểm "bây giờ",
 * nếu còn mới thì ghi đè giá trị của nó.
 */
export function withLiveEndpoint(
  h: PortfolioHistory,
  nowMs: number,
  liveValue: number | null,
): PortfolioHistory {
  if (h.points.length === 0 || liveValue == null || liveValue < 0) return h;
  const points = [...h.points];
  const last = points[points.length - 1]!;
  if (nowMs - last.t > 3_600_000) {
    points.push({ t: nowMs, value: liveValue });
  } else {
    points[points.length - 1] = { t: last.t, value: liveValue };
  }
  const startValue = points[0]!.value;
  const endValue = points[points.length - 1]!.value;
  return {
    points,
    startValue,
    endValue,
    pnl: endValue - startValue,
    pnlPct: startValue > 0 ? ((endValue - startValue) / startValue) * 100 : null,
  };
}

/**
 * Neo chuỗi giá thế giới về giá trong nước hiện tại: giữ nguyên dáng xu
 * hướng, chỉ nhân hệ số để điểm cuối khớp giá trị thật. Dùng cho vàng/bạc
 * (nến thế giới theo ounce, giá trong nước SJC/Ancarat cao hơn do chênh lệch).
 */
export function rescaleSeriesToCurrent(
  series: { t: number; c: number }[],
  current: number | null,
): { t: number; c: number }[] {
  if (current == null || current <= 0 || series.length === 0) return series;
  const last = series[series.length - 1]!.c;
  if (!Number.isFinite(last) || last <= 0) return series;
  const k = current / last;
  if (!Number.isFinite(k) || k <= 0) return series;
  return series.map((p) => ({ t: p.t, c: p.c * k }));
}

export { DAY_MS };

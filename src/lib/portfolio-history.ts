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
  /** Giá trị danh mục tại đầu kỳ (0 nếu lúc đó chưa mua gì). */
  startValue: number;
  endValue: number;
  /** Vốn mua thêm trong kỳ (theo giá mua, gồm phí — khớp định nghĩa vốn đã tích sản). */
  deposits: number;
  /**
   * Lãi/lỗ do GIÁ trong kỳ: giá trị cuối − giá trị đầu kỳ − tiền mua thêm.
   * Tiền mua thêm KHÔNG phải lãi — nếu không trừ, cứ mua thêm là PNL
   * tăng ảo (mua 211 USDT thì PNL tăng 211 USDT dù giá đang giảm).
   */
  pnl: number;
  /** PNL chia cho (giá trị đầu kỳ + tiền mua thêm). */
  pnlPct: number | null;
  /** Biên thời gian của kỳ (để chart vẽ theo trục thời gian thật). */
  fromMs: number;
  toMs: number;
}

const DAY_MS = 86_400_000;

export const HISTORY_PERIODS = ["1D", "1W", "1M", "3M", "1Y"] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

/** Số ngày mỗi kỳ xem: 1D→1, 1W→7, 1M→30, 3M→90, 1Y→365. */
export function historyPeriodDays(period: HistoryPeriod): number {
  return period === "1D" ? 1 : period === "1W" ? 7 : period === "1M" ? 30 : period === "3M" ? 90 : 365;
}

/** Nhãn tiếng Việt cho dòng PNL theo kỳ ("PNL trong 1 tháng …"). */
export function historyPeriodLabel(period: HistoryPeriod): string {
  return period === "1D"
    ? "1 ngày"
    : period === "1W"
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
  deposits: 0,
  pnl: 0,
  pnlPct: null,
  fromMs: 0,
  toMs: 0,
};

/** Tính PNL kỳ từ giá trị đầu/cuối và tiền mua thêm trong kỳ. */
function pnlOf(startValue: number, endValue: number, deposits: number): {
  pnl: number;
  pnlPct: number | null;
} {
  const pnl = endValue - startValue - deposits;
  const basis = startValue + deposits;
  return { pnl, pnlPct: basis > 0 ? (pnl / basis) * 100 : null };
}

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
    .map((t) => ({
      symbol: t.symbol,
      at: txDateMs(t.tx_date),
      qty: t.quantity,
      cost: t.quantity * Number(t.price_usd) + Number(t.fee_usd || 0),
    }))
    .filter((b) => Number.isFinite(b.qty) && b.qty > 0)
    .sort((a, b) => a.at - b.at);
  if (buys.length === 0) return EMPTY;
  // Một đồng đang nắm mà không có nến nào (tải nến lỗi VÀ không có giá live
  // để lấp) thì đừng vẽ chart thiếu đồng đó — trả rỗng để UI hiện "chưa có
  // dữ liệu" thay vì đường tổng thấp hẳn rồi điểm cuối live kéo lên, gây
  // PNL ảo (từng thấy PNL 1D nhảy +500 trong khi biến động thật chỉ vài USDT).
  const heldInPeriod = new Set(buys.filter((b) => b.at <= toMs).map((b) => b.symbol));
  for (const symbol of heldInPeriod) {
    const series = closesBySymbol[symbol];
    if (!series || series.length === 0) return EMPTY;
  }
  // Giá trị tại đầu kỳ: số lượng đã mua tới đầu kỳ × giá đóng cửa gần nhất
  // tại hoặc trước đầu kỳ (0 nếu lúc đó chưa mua gì).
  let startValue = 0;
  for (const [symbol, series] of Object.entries(closesBySymbol)) {
    const price = priceAt(series, fromMs);
    if (price == null || price <= 0) continue;
    let qty = 0;
    for (const b of buys) {
      if (b.symbol !== symbol) continue;
      if (b.at > fromMs) break;
      qty += b.qty;
    }
    if (qty > 0) startValue += qty * price;
  }
  // Vốn mua thêm trong kỳ (sau đầu kỳ, tới cuối kỳ): theo giá mua đã trả.
  const deposits = buys
    .filter((b) => b.at > fromMs && b.at <= toMs && Number.isFinite(b.cost))
    .reduce((s, b) => s + b.cost, 0);
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
  if (trimmed[0]!.t > fromMs) {
    // Mốc neo đầu kỳ để đường bắt đầu đúng ở mép trái theo trục thời gian:
    // chưa mua gì thì phẳng ở 0, đã mua từ trước thì bằng giá trị lúc đó.
    trimmed.unshift({ t: fromMs, value: startValue });
    if (startValue === 0) {
      // Thêm 1 điểm 0 ngay tại mốc đầu tiên có giá trị để đường đi ngang
      // ở 0 rồi nhảy thẳng đứng lên đúng ngày mua (logic OKX) — không
      // chéo dần từ đầu kỳ lên như khi chỉ có 1 điểm neo.
      trimmed.splice(1, 0, { t: trimmed[1]!.t, value: 0 });
    }
  }
  const endValue = trimmed[trimmed.length - 1]!.value;
  return {
    points: trimmed,
    startValue,
    endValue,
    deposits,
    ...pnlOf(startValue, endValue, deposits),
    fromMs,
    toMs,
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
  const startValue = h.startValue;
  const endValue = points[points.length - 1]!.value;
  return {
    points,
    startValue,
    endValue,
    deposits: h.deposits,
    ...pnlOf(startValue, endValue, h.deposits),
    fromMs: h.fromMs,
    toMs: h.toMs,
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

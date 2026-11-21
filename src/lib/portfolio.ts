import { coinName, normalizeSymbol } from "./coins";
import { parseDateOnly, toDateKey } from "./format";

export interface Tx {
  id: string;
  symbol: string;
  coin_name: string;
  quantity: number;
  price_usd: number;
  fee_usd: number;
  /** Giá mua chính xác bằng VND mỗi đơn vị (vàng/bạc luôn tính bằng VND). */
  price_vnd?: number | null;
  /** Phí chính xác bằng VND (vàng/bạc). */
  fee_vnd?: number | null;
  tx_date: string;
  note: string | null;
  updated_at?: string;
  created_at?: string;
}

export interface PriceQuote {
  usd: number;
  vnd: number;
  krw: number;
  change24h: number | null;
  /** Vàng/bạc: giá cửa hàng bán ra (VND mỗi chỉ / lượng); `vnd` là giá mua vào. */
  askVnd?: number;
  /** Vàng/bạc: nguồn giá (SJC, Ancarat). */
  source?: string;
  /** Vàng/bạc: mốc cập nhật giá (06:00 / 22:00 giờ Việt Nam), ISO. */
  updatedAt?: string;
}

export type PriceMap = Record<string, PriceQuote>;

export interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  investedUsd: number;
  avgCostUsd: number;
  priceUsd: number | null;
  valueUsd: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  change24h: number | null;
  purchases: number;
  /** Vốn bằng VND, chỉ có khi mọi lần mua đều lưu giá VND (vàng/bạc). */
  investedVnd: number | null;
  avgCostVnd: number | null;
  /** Giá trị theo giá VND hiện tại (vàng/bạc: giá mua vào). */
  valueVnd: number | null;
  pnlVnd: number | null;
}

/** Aggregates DCA purchases into holdings; values use live prices when available.
 * Giao dịch bán (quantity âm) giảm vốn theo GIÁ MUA TRUNG BÌNH tại thời
 * điểm bán — không theo giá bán — nên giá mua trung bình của phần còn lại
 * không bị lệch. Phí bán là chi phí đã thực hiện, không cộng vào vốn còn
 * lại. Giao dịch được xử lý theo thứ tự thời gian (tx_date, rồi id) vì
 * giá mua trung bình phụ thuộc vào thứ tự mua/bán. */
export function computeHoldings(txs: Tx[], prices: PriceMap = {}): Holding[] {
  const map = new Map<string, Holding>();
  const ordered = [...txs].sort((a, b) =>
    a.tx_date === b.tx_date
      ? a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0
      : a.tx_date < b.tx_date
        ? -1
        : 1,
  );
  for (const t of ordered) {
    const symbol = normalizeSymbol(t.symbol);
    const qty = Number(t.quantity);
    const h = map.get(symbol) ?? {
      symbol,
      name: coinName(symbol, t.coin_name),
      quantity: 0,
      investedUsd: 0,
      avgCostUsd: 0,
      priceUsd: null,
      valueUsd: null,
      pnlUsd: null,
      pnlPct: null,
      change24h: null,
      purchases: 0,
      investedVnd: 0,
      avgCostVnd: null,
      valueVnd: null,
      pnlVnd: null,
    };
    const pv = t.price_vnd == null ? NaN : Number(t.price_vnd);
    if (qty < 0) {
      // Bán: vốn giảm theo giá mua trung bình của phần đang nắm.
      const sellQty = -qty;
      const avgUsd = h.quantity > 0 ? h.investedUsd / h.quantity : 0;
      h.investedUsd -= sellQty * avgUsd;
      if (h.investedVnd != null) {
        const avgVnd = h.quantity > 0 ? h.investedVnd / h.quantity : 0;
        h.investedVnd -= sellQty * avgVnd;
      }
      h.quantity += qty;
    } else {
      const cost = qty * Number(t.price_usd) + Number(t.fee_usd || 0);
      h.quantity += qty;
      h.investedUsd += cost;
      h.investedVnd =
        h.investedVnd != null && Number.isFinite(pv)
          ? h.investedVnd + qty * pv + Number(t.fee_vnd || 0)
          : null;
      h.purchases += 1;
    }
    map.set(symbol, h);
  }
  // Làm tròn số lượng về 8 chữ số thập phân sau khi cộng dồn — tránh số lẻ
  // dài do cộng dồn số thực (vd 0,1 + 0,1 + 0,1 = 0,30000000000000004 thay
  // vì 0,3). Nút "Tối đa" ở Swap và các chỗ nhập số lượng dùng quantity này;
  // làm tròn ở đây thì đổi 100% cũng hết sạch (không còn bụi 4e-17).
  for (const h of map.values()) {
    h.quantity = Math.round(h.quantity * 1e8) / 1e8;
  }
  const out = [...map.values()].map((h) => {
    const q = prices[h.symbol];
    const avgCostUsd = h.quantity > 0 ? h.investedUsd / h.quantity : 0;
    const avgCostVnd = h.investedVnd != null && h.quantity > 0 ? h.investedVnd / h.quantity : null;
    const valueVnd = q && q.vnd > 0 ? h.quantity * q.vnd : null;
    const pnlVnd = valueVnd != null && h.investedVnd != null ? valueVnd - h.investedVnd : null;
    const base = { ...h, avgCostUsd, avgCostVnd, valueVnd, pnlVnd };
    if (!q || !(q.usd > 0)) return base;
    const valueUsd = h.quantity * q.usd;
    const pnlUsd = valueUsd - h.investedUsd;
    return {
      ...base,
      priceUsd: q.usd,
      valueUsd,
      pnlUsd,
      // Có vốn VND chính xác (vàng/bạc) thì % lãi/lỗ tính theo VND.
      pnlPct:
        pnlVnd != null && h.investedVnd
          ? (pnlVnd / h.investedVnd) * 100
          : h.investedUsd > 0
            ? (pnlUsd / h.investedUsd) * 100
            : null,
      change24h: q.change24h,
    };
  });
  return out.sort((a, b) => (b.valueUsd ?? b.investedUsd) - (a.valueUsd ?? a.investedUsd));
}

export interface PortfolioTotals {
  investedUsd: number;
  valueUsd: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
}

export function computeTotals(holdings: Holding[]): PortfolioTotals {
  const investedUsd = holdings.reduce((s, h) => s + h.investedUsd, 0);
  const allPriced = holdings.length > 0 && holdings.every((h) => h.valueUsd != null);
  if (!allPriced) return { investedUsd, valueUsd: null, pnlUsd: null, pnlPct: null };
  const valueUsd = holdings.reduce((s, h) => s + (h.valueUsd ?? 0), 0);
  const pnlUsd = valueUsd - investedUsd;
  return {
    investedUsd,
    valueUsd,
    pnlUsd,
    pnlPct: investedUsd > 0 ? (pnlUsd / investedUsd) * 100 : null,
  };
}

export interface AllocationSlice {
  symbol: string;
  name: string;
  percent: number;
  /** Lãi/lỗ % theo vốn của riêng token này (null khi chưa có giá live). */
  pnlPct?: number | null;
}

/** Allocation by current value; falls back to cost basis when any price is missing. */
export function computeAllocation(holdings: Holding[]): {
  slices: AllocationSlice[];
  basis: "value" | "cost";
} {
  const useValue = holdings.length > 0 && holdings.every((h) => h.valueUsd != null);
  const amount = (h: Holding) => (useValue ? (h.valueUsd ?? 0) : h.investedUsd);
  const total = holdings.reduce((s, h) => s + amount(h), 0);
  const slices =
    total > 0
      ? holdings
          .map((h) => ({
            symbol: h.symbol,
            name: h.name,
            percent: (amount(h) / total) * 100,
            pnlPct: h.pnlPct,
          }))
          .sort((a, b) => b.percent - a.percent)
      : [];
  return { slices, basis: useValue ? "value" : "cost" };
}

export interface StreakInfo {
  current: number;
  longest: number;
  activeDays: number;
  lastDate: string | null;
  boughtToday: boolean;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Daily accumulation streak. The current streak stays alive through today
 * if the user bought yesterday but not yet today.
 */
export function computeStreak(dates: string[], today: Date = new Date()): StreakInfo {
  const keys = new Set(dates.map((d) => toDateKey(parseDateOnly(d))));
  if (keys.size === 0)
    return { current: 0, longest: 0, activeDays: 0, lastDate: null, boughtToday: false };
  const sorted = [...keys].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseDateOnly(sorted[i - 1] ?? "");
    const expected = toDateKey(addDays(prev, 1));
    run = sorted[i] === expected ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const todayK = toDateKey(today);
  const boughtToday = keys.has(todayK);
  let cursor = boughtToday ? today : addDays(today, -1);
  let current = 0;
  while (keys.has(toDateKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return {
    current,
    longest,
    activeDays: keys.size,
    lastDate: sorted[sorted.length - 1] ?? null,
    boughtToday,
  };
}

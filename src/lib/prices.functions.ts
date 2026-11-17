import { createServerFn } from "@tanstack/react-start";
import { COINS } from "./coins";
import type { PriceMap } from "./portfolio";

export interface PricesResult {
  prices: PriceMap;
  usdVnd: number | null;
  fetchedAt: string;
  error: string | null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return (await res.json()) as T;
}

async function usdVndRate(): Promise<number | null> {
  try {
    const j = await fetchJson<{ rates?: Record<string, number> }>(
      "https://open.er-api.com/v6/latest/USD",
    );
    return j.rates?.["VND"] ?? null;
  } catch (e) {
    console.error("fx fetch failed", e);
    return null;
  }
}

/**
 * Vàng: PAXG trên OKX làm proxy (1 PAXG ≈ 1 ounce vàng). Nằm trong COINS
 * nên xuất hiện trong danh sách chọn khi thêm lần mua, ngay sau ETH.
 */
export const GOLD_SYMBOL = "PAXG";

/**
 * Bạc: KAG (Kinesis Silver) trên CoinGecko làm proxy (1 KAG ≈ 1 ounce bạc).
 * OKX không có cặp bạc nào (đã kiểm chứng 2026-11-17: không có XAG/KAG/SLV
 * trong bảng tickers SPOT), nên bạc chỉ lấy từ CoinGecko, không qua OKX.
 */
export const SILVER_SYMBOL = "KAG";

/** Spot prices from OKX (USDT pairs ≈ USD). */
async function okxPrices(): Promise<Record<string, { usd: number; change24h: number | null }>> {
  const j = await fetchJson<{ data?: { instId: string; last: string; open24h: string }[] }>(
    "https://www.okx.com/api/v5/market/tickers?instType=SPOT",
  );
  const bySymbol = new Map((j.data ?? []).map((t) => [t.instId, t]));
  const out: Record<string, { usd: number; change24h: number | null }> = {};
  for (const c of COINS) {
    if (c.symbol === "USDT") {
      out[c.symbol] = { usd: 1, change24h: 0 };
      continue;
    }
    const t = bySymbol.get(`${c.symbol}-USDT`) ?? bySymbol.get(`${c.symbol}-USDC`);
    const last = t ? Number(t.last) : NaN;
    const open = t ? Number(t.open24h) : NaN;
    if (Number.isFinite(last) && last > 0) {
      out[c.symbol] = {
        usd: last,
        change24h: Number.isFinite(open) && open > 0 ? ((last - open) / open) * 100 : null,
      };
    }
  }
  // Vàng (PAXG-USDT) lấy từ cùng bảng giá OKX qua vòng lặp COINS ở trên.
  return out;
}

/** Fallback riêng cho vàng khi OKX không trả PAXG: CoinGecko pax-gold, không cần key. */
async function paxgGeckoPrice(): Promise<{ usd: number; change24h: number | null } | null> {
  try {
    const j = await fetchJson<Record<string, { usd?: number; usd_24h_change?: number }>>(
      "https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd&include_24hr_change=true",
    );
    const p = j["pax-gold"];
    if (p?.usd != null) return { usd: p.usd, change24h: p.usd_24h_change ?? null };
  } catch (e) {
    console.error("paxg coingecko failed", e);
  }
  return null;
}

/** Fallback riêng cho bạc khi OKX không có cặp bạc: CoinGecko kinesis-silver, không cần key. */
async function kagGeckoPrice(): Promise<{ usd: number; change24h: number | null } | null> {
  try {
    const j = await fetchJson<Record<string, { usd?: number; usd_24h_change?: number }>>(
      "https://api.coingecko.com/api/v3/simple/price?ids=kinesis-silver&vs_currencies=usd&include_24hr_change=true",
    );
    const p = j["kinesis-silver"];
    if (p?.usd != null) return { usd: p.usd, change24h: p.usd_24h_change ?? null };
  } catch (e) {
    console.error("kag coingecko failed", e);
  }
  return null;
}

async function geckoPrices(): Promise<Record<string, { usd: number; change24h: number | null }>> {
  const ids = COINS.map((c) => c.geckoId).join(",");
  const j = await fetchJson<Record<string, { usd?: number; usd_24h_change?: number }>>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
  );
  const out: Record<string, { usd: number; change24h: number | null }> = {};
  for (const c of COINS) {
    const p = j[c.geckoId];
    if (p?.usd != null) out[c.symbol] = { usd: p.usd, change24h: p.usd_24h_change ?? null };
  }
  return out;
}

/** Public market prices (no user data) for all supported coins, in USD and VND. */
export const getPrices = createServerFn({ method: "GET" }).handler(
  async (): Promise<PricesResult> => {
    const ratePromise = usdVndRate();
    let usd: Record<string, { usd: number; change24h: number | null }> = {};
    try {
      usd = await okxPrices();
    } catch (e) {
      console.error("okx prices failed", e);
    }
    if (Object.keys(usd).length < 3) {
      try {
        usd = { ...(await geckoPrices()), ...usd };
      } catch (e) {
        console.error("coingecko prices failed", e);
      }
    }
    // Vàng: nếu OKX không trả PAXG thì thử CoinGecko, vẫn không có thì để trống.
    if (!usd[GOLD_SYMBOL]) {
      const paxg = await paxgGeckoPrice();
      if (paxg) usd[GOLD_SYMBOL] = paxg;
    }
    // Bạc: OKX không có cặp bạc nên luôn lấy từ CoinGecko nếu chưa có giá.
    if (!usd[SILVER_SYMBOL]) {
      const kag = await kagGeckoPrice();
      if (kag) usd[SILVER_SYMBOL] = kag;
    }
    const usdVnd = await ratePromise;
    const prices: PriceMap = {};
    for (const [sym, q] of Object.entries(usd)) {
      prices[sym] = { usd: q.usd, vnd: usdVnd ? q.usd * usdVnd : 0, change24h: q.change24h };
    }
    const error =
      Object.keys(prices).length === 0
        ? "Không tải được giá thị trường. Vui lòng thử lại sau."
        : usdVnd == null
          ? "Không tải được tỷ giá USD/VND."
          : null;
    return { prices, usdVnd, fetchedAt: new Date().toISOString(), error };
  },
);

export type ChartRange = "1D" | "1M" | "1Y";

export interface CandlePoint {
  /** Epoch ms. */
  t: number;
  /** Close price in USD. */
  c: number;
}

export interface CandlesResult {
  symbol: string;
  range: ChartRange;
  points: CandlePoint[];
  /** % change from first to last point, null when it cannot be computed. */
  changePct: number | null;
  error: string | null;
}

const CHART_ERR = "Không tải được biểu đồ. Vui lòng thử lại sau.";

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)] as T);
  const last = arr[arr.length - 1] as T;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** OKX candlesticks (public, no key). Rows are newest-first: [ts, o, h, l, c, ...]. */
async function okxCandles(
  symbol: string,
  range: ChartRange,
): Promise<CandlePoint[] | null> {
  const [bar, limit] =
    range === "1D" ? ["1H", 24] : range === "1M" ? ["1D", 30] : ["1W", 52];
  const j = await fetchJson<{ code?: string; data?: string[][] }>(
    `https://www.okx.com/api/v5/market/candles?instId=${symbol}-USDT&bar=${bar}&limit=${limit}`,
  );
  const rows = j.data ?? [];
  if (rows.length === 0) return null;
  const pts: CandlePoint[] = rows
    .map((r) => ({ t: Number(r[0]), c: Number(r[4]) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c) && p.c > 0)
    .sort((a, b) => a.t - b.t);
  return pts.length > 0 ? pts : null;
}

/** CoinGecko market chart (public, no key); used for silver (no OKX pair) and as fallback. */
async function geckoCandles(
  geckoId: string,
  range: ChartRange,
): Promise<CandlePoint[] | null> {
  const days = range === "1D" ? 1 : range === "1M" ? 30 : 365;
  const j = await fetchJson<{ prices?: [number, number][] }>(
    `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart?vs_currency=usd&days=${days}`,
  );
  const rows = j.prices ?? [];
  if (rows.length === 0) return null;
  const pts: CandlePoint[] = rows
    .map(([t, c]) => ({ t, c }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c) && p.c > 0);
  return pts.length > 0 ? downsample(pts, 120) : null;
}

/**
 * Historical closes for the chart popup (no user data). OKX first; silver
 * and stablecoins go straight to CoinGecko (OKX has no pair for them).
 */
export const getCandles = createServerFn({ method: "GET" })
  .inputValidator((input: { symbol?: unknown; range?: unknown }) => {
    const symbol = typeof input?.symbol === "string" ? input.symbol.toUpperCase() : "";
    const range: ChartRange = input?.range === "1M" || input?.range === "1Y" ? input.range : "1D";
    const coin = COINS.find((c) => c.symbol === symbol);
    if (!coin) throw new Error("Coin không hỗ trợ.");
    return { symbol: coin.symbol, geckoId: coin.geckoId, range };
  })
  .handler(async ({ data }): Promise<CandlesResult> => {
    const { symbol, geckoId, range } = data;
    let points: CandlePoint[] | null = null;
    const geckoOnly = symbol === SILVER_SYMBOL || symbol === "USDT" || symbol === "USDC";
    if (!geckoOnly) {
      try {
        points = await okxCandles(symbol, range);
      } catch (e) {
        console.error("okx candles failed", e);
      }
    }
    if (!points) {
      try {
        points = await geckoCandles(geckoId, range);
      } catch (e) {
        console.error("coingecko candles failed", e);
      }
    }
    if (!points || points.length < 2) {
      return { symbol, range, points: [], changePct: null, error: CHART_ERR };
    }
    const first = points[0]?.c ?? 0;
    const last = points[points.length - 1]?.c ?? 0;
    const changePct = first > 0 ? ((last - first) / first) * 100 : null;
    return { symbol, range, points, changePct, error: null };
  });

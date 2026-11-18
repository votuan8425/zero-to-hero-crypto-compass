import { createServerFn } from "@tanstack/react-start";
import { COINS } from "./coins";
import { deriveBidAsk, GOLD_SYMBOL, SILVER_SYMBOL } from "./metals";
import type { PriceMap } from "./portfolio";

// Ký hiệu vàng/bạc giữ nguyên đường import cũ cho các file khác dùng.
export { GOLD_SYMBOL, SILVER_SYMBOL } from "./metals";

export interface PricesResult {
  prices: PriceMap;
  usdVnd: number | null;
  usdKrw: number | null;
  fetchedAt: string;
  error: string | null;
}

/** User-Agent trình duyệt thật: một số API/CDN (Cloudflare) chặn UA mặc định
 *  của server (undici/node) nên server Lovable có lúc không lấy được dữ liệu. */
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": BROWSER_UA },
    // Tránh treo cả server function khi API chậm.
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return (await res.json()) as T;
}

/** Tỷ giá USD → VND và USD → KRW (cùng một lần gọi, không cần key). */
async function fxRates(): Promise<{ vnd: number | null; krw: number | null }> {
  try {
    const j = await fetchJson<{ rates?: Record<string, number> }>(
      "https://open.er-api.com/v6/latest/USD",
    );
    return { vnd: j.rates?.["VND"] ?? null, krw: j.rates?.["KRW"] ?? null };
  } catch (e) {
    console.error("fx fetch failed", e);
    return { vnd: null, krw: null };
  }
}

/** Spot prices from OKX (USDT pairs ≈ USD). Vàng kèm bid/ask thật từ sổ lệnh. */
async function okxPrices(): Promise<
  Record<string, { usd: number; change24h: number | null; bid?: number; ask?: number }>
> {
  const j = await fetchJson<{
    data?: { instId: string; last: string; open24h: string; bidPx?: string; askPx?: string }[]
  }>("https://www.okx.com/api/v5/market/tickers?instType=SPOT");
  const bySymbol = new Map((j.data ?? []).map((t) => [t.instId, t]));
  const out: Record<string, { usd: number; change24h: number | null; bid?: number; ask?: number }> =
    {};
  for (const c of COINS) {
    if (c.symbol === "USDT") {
      out[c.symbol] = { usd: 1, change24h: 0 };
      continue;
    }
    const t = bySymbol.get(`${c.symbol}-USDT`) ?? bySymbol.get(`${c.symbol}-USDC`);
    const last = t ? Number(t.last) : NaN;
    const open = t ? Number(t.open24h) : NaN;
    if (Number.isFinite(last) && last > 0) {
      const bid = t ? Number(t.bidPx) : NaN;
      const ask = t ? Number(t.askPx) : NaN;
      out[c.symbol] = {
        usd: last,
        change24h: Number.isFinite(open) && open > 0 ? ((last - open) / open) * 100 : null,
        // Chỉ vàng cần giá mua/bán; bid/ask của các coin khác không dùng tới.
        ...(c.symbol === GOLD_SYMBOL && Number.isFinite(bid) && bid > 0 ? { bid } : {}),
        ...(c.symbol === GOLD_SYMBOL && Number.isFinite(ask) && ask > 0 ? { ask } : {}),
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

/**
 * Giá bạc khi OKX không có cặp bạc: CoinGecko kinesis-silver, không cần key.
 * Lưu ý: simple/price trả về {} cho coin này (đã kiểm chứng 17/11/2026),
 * nên dùng market_chart 1 ngày và lấy điểm cuối làm giá hiện tại.
 */
async function kagGeckoPrice(): Promise<{ usd: number; change24h: number | null } | null> {
  try {
    const j = await fetchJson<{ prices?: [number, number][] }>(
      "https://api.coingecko.com/api/v3/coins/kinesis-silver/market_chart?vs_currency=usd&days=1",
    );
    const rows = (j.prices ?? []).filter(([, c]) => Number.isFinite(c) && c > 0);
    if (rows.length < 2) return null;
    const first = rows[0]?.[1] ?? 0;
    const last = rows[rows.length - 1]?.[1] ?? 0;
    if (!(last > 0) || !(first > 0)) return null;
    return { usd: last, change24h: ((last - first) / first) * 100 };
  } catch (e) {
    console.error("kag coingecko failed", e);
  }
  return null;
}

/**
 * % chênh lệch mua/bán của bạc từ CoinGecko tickers — endpoint này không cho
 * sẵn giá bid/ask, chỉ cho spread % (đã kiểm chứng 2026-11-18: ticker
 * KAG/C1USD của Kinesis Money trả spread, ví dụ 0,113676%).
 * Dùng kèm giá last từ market_chart để suy ra bid/ask (xem deriveBidAsk).
 */
async function kagSpreadPct(): Promise<number | null> {
  try {
    const j = await fetchJson<{
      tickers?: { target?: string; bid_ask_spread_percentage?: number }[];
    }>("https://api.coingecko.com/api/v3/coins/kinesis-silver/tickers");
    const tickers = j.tickers ?? [];
    const t =
      tickers.find((x) => x.target === "C1USD") ??
      tickers.find((x) => x.target === "USD" || x.target === "USDT" || x.target === "USDC") ??
      tickers[0];
    const s = t?.bid_ask_spread_percentage;
    return typeof s === "number" && Number.isFinite(s) && s >= 0 ? s : null;
  } catch (e) {
    console.error("kag tickers failed", e);
    return null;
  }
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

/** Public market prices (no user data) for all supported coins, in USD, VND and KRW. */
export const getPrices = createServerFn({ method: "GET" }).handler(
  async (): Promise<PricesResult> => {
    const ratePromise = fxRates();
    let usd: Record<string, { usd: number; change24h: number | null; bid?: number; ask?: number }> =
      {};
    try {
      usd = await okxPrices();
    } catch (e) {
      console.error("okx prices failed", e);
    }
    // Bổ sung coin nào OKX không niêm yết (VD: TON không có trong bảng
    // tickers SPOT của OKX — đã kiểm chứng) từ CoinGecko; OKX vẫn là nguồn
    // chính cho các coin đã có giá. Bạc (KAG) không dùng simple/price được
    // nên vẫn lấy riêng bằng market_chart ở dưới.
    const missing = COINS.filter(
      (c) => c.symbol !== "USDT" && c.symbol !== SILVER_SYMBOL && !usd[c.symbol],
    );
    if (missing.length > 0) {
      try {
        const g = await geckoPrices();
        for (const c of missing) {
          const q = g[c.symbol];
          if (q) usd[c.symbol] = q;
        }
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
    // Kèm % spread từ tickers để suy ra giá mua/bán (không bịa spread).
    if (!usd[SILVER_SYMBOL]) {
      const [kag, spread] = await Promise.all([kagGeckoPrice(), kagSpreadPct()]);
      if (kag) {
        usd[SILVER_SYMBOL] =
          spread != null ? { ...kag, ...deriveBidAsk(kag.usd, spread) } : kag;
      }
    }
    const fx = await ratePromise;
    const usdVnd = fx.vnd;
    const usdKrw = fx.krw;
    const prices: PriceMap = {};
    for (const [sym, q] of Object.entries(usd)) {
      prices[sym] = {
        usd: q.usd,
        vnd: usdVnd ? q.usd * usdVnd : 0,
        krw: usdKrw ? q.usd * usdKrw : 0,
        change24h: q.change24h,
        // Giá mua/bán vàng/bạc luôn quy ra VND ngay từ lúc tải.
        ...(q.bid != null && usdVnd ? { bidVnd: q.bid * usdVnd } : {}),
        ...(q.ask != null && usdVnd ? { askVnd: q.ask * usdVnd } : {}),
      };
    }
    const error =
      Object.keys(prices).length === 0
        ? "Không tải được giá thị trường. Vui lòng thử lại sau."
        : usdVnd == null
          ? "Không tải được tỷ giá."
          : null;
    return { prices, usdVnd, usdKrw, fetchedAt: new Date().toISOString(), error };
  },
);

export type ChartRange = "1D" | "1M" | "1Y";

/** Số nến hiển thị trong một cửa sổ chart (kéo thả để xem nến cũ hơn). */
export const CHART_VISIBLE_COUNT: Record<ChartRange, number> = {
  "1D": 24,
  "1M": 30,
  "1Y": 52,
};

export interface CandlePoint {
  /** Epoch ms. */
  t: number;
  /** Open price in USD. */
  o: number;
  /** High price in USD. */
  h: number;
  /** Low price in USD. */
  l: number;
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

/**
 * Gom chuỗi giá [thời gian, giá] thành nến OHLC theo khung giờ bucketMs.
 * Mở = giá đầu tiên, đóng = giá cuối cùng, cao/thấp = max/min trong khung.
 * Dùng cho nguồn chỉ trả chuỗi giá (CoinGecko); OKX đã trả sẵn OHLC.
 */
export function bucketPricesToCandles(
  rows: { t: number; c: number }[],
  bucketMs: number,
): CandlePoint[] {
  const sorted = [...rows].sort((a, b) => a.t - b.t);
  const buckets = new Map<number, CandlePoint>();
  for (const p of sorted) {
    if (!Number.isFinite(p.t) || !Number.isFinite(p.c) || p.c <= 0) continue;
    const key = Math.floor(p.t / bucketMs);
    const cur = buckets.get(key);
    if (!cur) {
      buckets.set(key, { t: p.t, o: p.c, h: p.c, l: p.c, c: p.c });
    } else {
      cur.h = Math.max(cur.h, p.c);
      cur.l = Math.min(cur.l, p.c);
      cur.c = p.c;
    }
  }
  return [...buckets.values()].sort((a, b) => a.t - b.t);
}

/** OKX candlesticks (public, no key). Rows are newest-first: [ts, o, h, l, c, ...].
 *  Nạp gấp 3 lần số nến hiển thị để kéo thả (pan) xem được nến cũ hơn. */
async function okxCandles(
  symbol: string,
  range: ChartRange,
): Promise<CandlePoint[] | null> {
  const bar = range === "1D" ? "1H" : range === "1M" ? "1D" : "1W";
  const limit = CHART_VISIBLE_COUNT[range] * 3;
  const j = await fetchJson<{ code?: string; data?: string[][] }>(
    `https://www.okx.com/api/v5/market/candles?instId=${symbol}-USDT&bar=${bar}&limit=${limit}`,
  );
  // Chỉ dùng dữ liệu khi OKX báo thành công (code "0"); lỗi thì trả null
  // để rơi xuống CoinGecko thay vì vẽ chart từ dữ liệu rỗng/lỗi.
  if (j.code !== "0") return null;
  const rows = j.data ?? [];
  if (rows.length === 0) return null;
  const pts: CandlePoint[] = rows
    .map((r) => ({
      t: Number(r[0]),
      o: Number(r[1]),
      h: Number(r[2]),
      l: Number(r[3]),
      c: Number(r[4]),
    }))
    .filter(
      (p) =>
        [p.t, p.o, p.h, p.l, p.c].every((v) => Number.isFinite(v)) &&
        p.o > 0 &&
        p.h > 0 &&
        p.l > 0 &&
        p.c > 0,
    )
    .sort((a, b) => a.t - b.t);
  return pts.length > 0 ? pts : null;
}

/** CoinGecko market chart (public, no key); used for silver (no OKX pair) and as fallback. */
async function geckoCandles(
  geckoId: string,
  range: ChartRange,
): Promise<CandlePoint[] | null> {
  // Nạp gấp 3 lần để kéo thả: 1D→3 ngày, 1M→90 ngày, 1Y→365 ngày (giới hạn free API
  // nên khung Năm qua CoinGecko chỉ đủ 1 cửa sổ, không kéo được xa).
  const days = range === "1D" ? 3 : range === "1M" ? 90 : 365;
  const j = await fetchJson<{ prices?: [number, number][] }>(
    `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart?vs_currency=usd&days=${days}`,
  );
  const rows = j.prices ?? [];
  if (rows.length === 0) return null;
  // CoinGecko chỉ trả chuỗi giá (không có OHLC) nên gom theo khung giờ
  // trùng với khung nến OKX (1D→1 giờ, 1M→1 ngày, 1Y→1 tuần).
  const bucketMs =
    range === "1D" ? 3_600_000 : range === "1M" ? 86_400_000 : 604_800_000;
  const pts = bucketPricesToCandles(
    rows.map(([t, c]) => ({ t, c })),
    bucketMs,
  );
  return pts.length > 0 ? pts : null;
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

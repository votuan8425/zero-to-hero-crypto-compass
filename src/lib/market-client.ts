import { COINS } from "./coins";
import type { PriceMap } from "./portfolio";
import {
  bucketPricesToCandles,
  type CandlesResult,
  type ChartRange,
  type PricesResult,
} from "./prices.functions";

/**
 * Lấy giá / nến TRỰC TIẾP từ trình duyệt (CoinGecko, cho phép CORS) — dùng
 * làm phương án dự phòng khi server function của Lovable không lấy được
 * dữ liệu từ OKX/CoinGecko (server bị chặn/rate-limit nên bảng giá chỉ
 * hiện giá đã lưu và chart báo "Không tải được biểu đồ").
 *
 * Trong trình duyệt KHÔNG được tự đặt header User-Agent (trình duyệt tự
 * gửi UA thật của nó nên không bị Cloudflare chặn như UA mặc định của
 * server). Chỉ dùng CoinGecko ở đây vì nó chắc chắn cho phép CORS; OKX
 * vẫn lấy qua server function là chính.
 */

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return (await res.json()) as T;
}

/** Giá thị trường lấy trực tiếp từ trình duyệt (CoinGecko + tỷ giá). */
export async function fetchPricesFromBrowser(): Promise<PricesResult> {
  const ids = COINS.filter((c) => !c.unit)
    .map((c) => c.geckoId)
    .join(",");
  const [gecko, fx] = await Promise.all([
    fetchJson<Record<string, { usd?: number; usd_24h_change?: number }>>(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
    ).catch(() => ({} as Record<string, { usd?: number; usd_24h_change?: number }>)),
    fetchJson<{ rates?: Record<string, number> }>(
      "https://open.er-api.com/v6/latest/USD",
    ).catch(() => ({} as { rates?: Record<string, number> })),
  ]);
  const usd: Record<string, { usd: number; change24h: number | null }> = {};
  for (const c of COINS) {
    // Vàng/bạc tính theo giá SJC / Ancarat (chỉ lấy được qua server), không
    // dùng giá ounce thế giới ở đây để tránh sai đơn vị.
    if (c.unit) continue;
    if (c.symbol === "USDT") {
      usd[c.symbol] = { usd: 1, change24h: 0 };
      continue;
    }
    const p = gecko[c.geckoId];
    if (p?.usd != null) usd[c.symbol] = { usd: p.usd, change24h: p.usd_24h_change ?? null };
  }
  const usdVnd = fx.rates?.["VND"] ?? null;
  const usdKrw = fx.rates?.["KRW"] ?? null;
  const prices: PriceMap = {};
  for (const [sym, q] of Object.entries(usd)) {
    prices[sym] = {
      usd: q.usd,
      vnd: usdVnd ? q.usd * usdVnd : 0,
      krw: usdKrw ? q.usd * usdKrw : 0,
      change24h: q.change24h,
    };
  }
  const error =
    Object.keys(prices).length === 0
      ? "Không tải được giá thị trường. Vui lòng thử lại sau."
      : usdVnd == null
        ? "Không tải được tỷ giá."
        : null;
  return { prices, usdVnd, usdKrw, fetchedAt: new Date().toISOString(), error };
}

const CHART_ERR = "Không tải được biểu đồ. Vui lòng thử lại sau.";

/** Nến OHLC lấy trực tiếp từ trình duyệt (CoinGecko market_chart + gom nến). */
export async function fetchCandlesFromBrowser(
  symbol: string,
  range: ChartRange,
): Promise<CandlesResult> {
  const coin = COINS.find((c) => c.symbol === symbol);
  if (!coin) return { symbol, range, points: [], changePct: null, error: "Coin không hỗ trợ." };
  const days = range === "1D" ? 3 : range === "1M" ? 90 : 365;
  const bucketMs =
    range === "1D" ? 3_600_000 : range === "1M" ? 86_400_000 : 604_800_000;
  try {
    const j = await fetchJson<{ prices?: [number, number][] }>(
      `https://api.coingecko.com/api/v3/coins/${coin.geckoId}/market_chart?vs_currency=usd&days=${days}`,
    );
    const points = bucketPricesToCandles(
      (j.prices ?? []).map(([t, c]) => ({ t, c })),
      bucketMs,
    );
    if (points.length < 2) {
      return { symbol, range, points: [], changePct: null, error: CHART_ERR };
    }
    const first = points[0]?.c ?? 0;
    const last = points[points.length - 1]?.c ?? 0;
    const changePct = first > 0 ? ((last - first) / first) * 100 : null;
    return { symbol, range, points, changePct, error: null };
  } catch {
    return { symbol, range, points: [], changePct: null, error: CHART_ERR };
  }
}

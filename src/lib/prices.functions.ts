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
  return out;
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

import { createServerFn } from "@tanstack/react-start";
import { COINS } from "./coins";
import type { PriceMap } from "./portfolio";

export interface PricesResult {
  prices: PriceMap;
  usdVnd: number | null;
  fetchedAt: string;
  error: string | null;
}

/** Public market prices (no user data) from CoinGecko, in USD and VND. */
export const getPrices = createServerFn({ method: "POST" })
  .inputValidator((input: { symbols: string[] }) => ({
    symbols: Array.isArray(input?.symbols)
      ? input.symbols.slice(0, 60).map((s) => String(s).toUpperCase())
      : [],
  }))
  .handler(async ({ data }): Promise<PricesResult> => {
    const wanted = new Set([...data.symbols, "USDT"]);
    const coins = COINS.filter((c) => wanted.has(c.symbol));
    const ids = coins.map((c) => c.geckoId).join(",");
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,vnd&include_24hr_change=true`,
        { headers: { accept: "application/json" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Record<
        string,
        { usd?: number; vnd?: number; usd_24h_change?: number }
      >;
      const prices: PriceMap = {};
      for (const c of coins) {
        const p = json[c.geckoId];
        if (p?.usd != null)
          prices[c.symbol] = { usd: p.usd, vnd: p.vnd ?? 0, change24h: p.usd_24h_change ?? null };
      }
      const usdt = json["tether"];
      const usdVnd = usdt?.usd && usdt?.vnd ? usdt.vnd / usdt.usd : null;
      return { prices, usdVnd, fetchedAt: new Date().toISOString(), error: null };
    } catch (e) {
      console.error("price fetch failed", e);
      return {
        prices: {},
        usdVnd: null,
        fetchedAt: new Date().toISOString(),
        error: "Không tải được giá thị trường. Vui lòng thử lại sau.",
      };
    }
  });

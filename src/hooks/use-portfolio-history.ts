/**
 * Nạp nến lịch sử cho biểu đồ xu hướng tài sản ở trang chủ.
 *
 * - Kỳ 1W/1M/3M dùng nến ngày (getCandles "1M" = 90 ngày).
 * - Kỳ 1Y dùng nến tuần (getCandles "1Y" = 156 tuần ≈ 3 năm).
 * Nạp cả hai loại một lần cho mọi symbol đang nắm giữ, các kỳ chỉ cắt
 * lát từ cùng dữ liệu đó. Nguồn chính là server (OKX, CoinGecko dự phòng),
 * lỗi thì lấy trực tiếp từ trình duyệt (CoinGecko) như dialog biểu đồ giá.
 * Vàng/bạc: nến thế giới USD/ounce → USD mỗi chỉ/lượng, rồi neo về giá
 * trong nước hiện tại. Stablecoin luôn = 1 USD, không cần gọi API.
 */

import { useQuery } from "@tanstack/react-query";
import { OUNCE_TO_CHI, OUNCE_TO_LUONG } from "@/lib/coins";
import { fetchCandlesFromBrowser } from "@/lib/market-client";
import { rescaleSeriesToCurrent } from "@/lib/portfolio-history";
import type { PriceMap } from "@/lib/portfolio";
import { getCandles, type ChartRange } from "@/lib/prices.functions";

export interface HistorySeries {
  /** Nến giờ (3 ngày) theo symbol — dùng cho kỳ 1D. */
  hourly: Record<string, { t: number; c: number }[]>;
  /** Nến ngày (90 ngày) theo symbol. */
  daily: Record<string, { t: number; c: number }[]>;
  /** Nến tuần (~3 năm) theo symbol. */
  weekly: Record<string, { t: number; c: number }[]>;
}

type ClosePoint = { t: number; c: number };

async function loadSeries(symbol: string, range: ChartRange): Promise<ClosePoint[]> {
  if (symbol === "USDT" || symbol === "USDC") {
    return [{ t: Date.now() - 3 * 365 * 86_400_000, c: 1 }];
  }
  const server = await getCandles({ data: { symbol, range } }).catch(() => null);
  const res =
    server && !server.error && server.points.length >= 2
      ? server
      : await fetchCandlesFromBrowser(symbol, range);
  return res.points.map((p) => ({ t: p.t, c: p.c }));
}

/** Vàng/bạc: nến thế giới USD/ounce → USD mỗi chỉ/lượng, neo về giá trong nước. */
function convertMetal(
  symbol: string,
  series: ClosePoint[],
  prices: PriceMap | undefined,
): ClosePoint[] {
  if (symbol !== "PAXG" && symbol !== "KAG") return series;
  const div = symbol === "PAXG" ? OUNCE_TO_CHI : OUNCE_TO_LUONG;
  const perUnit = series.map((p) => ({ t: p.t, c: p.c / div }));
  return rescaleSeriesToCurrent(perUnit, prices?.[symbol]?.usd ?? null);
}

/** Query nến lịch sử (cùng key + queryFn với hook bên dưới) để màn hình chờ
 *  (boot) prefetch được trước khi cho vào app — chart và PNL kỳ 1M phải
 *  tính được từ nến thật thì mới vào trang chủ. */
export function portfolioHistoryQuery(symbols: string[], prices: PriceMap | undefined) {
  const key = [...new Set(symbols)].sort().join(",");
  return {
    queryKey: ["portfolio-history", key] as const,
    queryFn: async (): Promise<HistorySeries> => {
      const syms = [...new Set(symbols)];
      const hourly: HistorySeries["hourly"] = {};
      const daily: HistorySeries["daily"] = {};
      const weekly: HistorySeries["weekly"] = {};
      await Promise.all(
        syms.map(async (s) => {
          const [h, d, w] = await Promise.all([
            loadSeries(s, "1D"),
            loadSeries(s, "1M"),
            loadSeries(s, "1Y"),
          ]);
          hourly[s] = convertMetal(s, h, prices);
          daily[s] = convertMetal(s, d, prices);
          weekly[s] = convertMetal(s, w, prices);
        }),
      );
      return { hourly, daily, weekly };
    },
    staleTime: 5 * 60_000,
  };
}

export function usePortfolioHistory(symbols: string[], prices: PriceMap | undefined) {
  return useQuery({
    ...portfolioHistoryQuery(symbols, prices),
    enabled: symbols.length > 0,
  });
}

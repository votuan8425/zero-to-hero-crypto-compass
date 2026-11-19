/**
 * Nạp nến lịch sử cho biểu đồ xu hướng tài sản ở trang chủ.
 *
 * - Kỳ 1D dùng nến giờ (getCandles "1D" = 3 ngày).
 * - Kỳ 1W/1M/3M dùng nến ngày (getCandles "1M" = 90 ngày).
 * - Kỳ 1Y dùng nến tuần (getCandles "1Y" = 156 tuần ≈ 3 năm).
 * Chỉ nạp chuỗi của kỳ đang xem (query key có kỳ) — đổi kỳ thì nạp chuỗi
 * của kỳ đó. Nguồn chính là server (OKX, CoinGecko dự phòng), lỗi thì lấy
 * trực tiếp từ trình duyệt (CoinGecko) như dialog biểu đồ giá.
 * Vàng/bạc: nến thế giới USD/ounce → USD mỗi chỉ/lượng, rồi neo về giá
 * trong nước hiện tại. Stablecoin luôn = 1 USD, không cần gọi API.
 */

import { useQuery } from "@tanstack/react-query";
import { OUNCE_TO_CHI, OUNCE_TO_LUONG } from "@/lib/coins";
import { fetchCandlesFromBrowser } from "@/lib/market-client";
import { rescaleSeriesToCurrent, type HistoryPeriod } from "@/lib/portfolio-history";
import type { PriceMap } from "@/lib/portfolio";
import { getCandles, type ChartRange } from "@/lib/prices.functions";

export interface HistorySeries {
  /** Nến giờ (3 ngày) theo symbol — chỉ có khi query kỳ 1D. */
  hourly: Record<string, { t: number; c: number }[]>;
  /** Nến ngày (90 ngày) theo symbol — chỉ có khi query kỳ 1W/1M/3M. */
  daily: Record<string, { t: number; c: number }[]>;
  /** Nến tuần (~3 năm) theo symbol — chỉ có khi query kỳ 1Y. */
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

/**
 * Nến của một đồng tải lỗi (server OKX + CoinGecko lỗi, trình duyệt cũng
 * lỗi) thì chuỗi rỗng — vẽ chart từ chuỗi rỗng sẽ lặng lẽ bỏ đồng đó, đường
 * tổng thấp hẳn rồi điểm cuối live kéo lên gây PNL ảo (từng thấy PNL 1D
 * nhảy +500 trong khi biến động thật chỉ vài USDT). Lấp bằng đường phẳng
 * ở giá live hiện tại: đúng mức giá, chỉ không có biến động, nên tổng và
 * PNL gần đúng. Không có cả giá live thì giữ chuỗi rỗng (hàm tính lịch sử
 * sẽ trả rỗng thay vì vẽ sai).
 */
function fillIfMissing(
  series: ClosePoint[],
  liveUsd: number | null | undefined,
): ClosePoint[] {
  if (series.length >= 2) return series;
  if (liveUsd == null || !Number.isFinite(liveUsd) || liveUsd <= 0) return series;
  const now = Date.now();
  return [
    { t: now - 3 * 365 * 86_400_000, c: liveUsd },
    { t: now, c: liveUsd },
  ];
}

/** Query nến lịch sử (cùng key + queryFn với hook bên dưới) để màn hình chờ
 *  (boot) prefetch được trước khi cho vào app — chart và PNL kỳ 1M phải
 *  tính được từ nến thật thì mới vào trang chủ.
 *
 *  Chỉ nạp đúng chuỗi nến của kỳ đang xem (1D→giờ, 1Y→tuần, còn lại→ngày)
 *  thay vì nạp cả 3 loại cho mọi đồng — trước đây trang chủ + màn hình chờ
 *  nạp 6 chuỗi (3 loại × 2 đồng), mỗi chuỗi thử server rồi trình duyệt, nên
 *  mở app chậm và lag khi server bị giới hạn. Đổi kỳ thì nạp chuỗi của kỳ
 *  đó (đã nạp rồi thì lấy từ cache, không gọi lại). */
export function portfolioHistoryQuery(
  symbols: string[],
  prices: PriceMap | undefined,
  period: HistoryPeriod,
) {
  const key = [...new Set(symbols)].sort().join(",");
  const range: ChartRange = period === "1D" ? "1D" : period === "1Y" ? "1Y" : "1M";
  return {
    queryKey: ["portfolio-history", key, period] as const,
    queryFn: async (): Promise<HistorySeries> => {
      const syms = [...new Set(symbols)];
      const hourly: HistorySeries["hourly"] = {};
      const daily: HistorySeries["daily"] = {};
      const weekly: HistorySeries["weekly"] = {};
      await Promise.all(
        syms.map(async (s) => {
          const series = await loadSeries(s, range);
          const liveUsd = prices?.[s]?.usd ?? null;
          const filled = fillIfMissing(convertMetal(s, series, prices), liveUsd);
          if (range === "1D") hourly[s] = filled;
          else if (range === "1Y") weekly[s] = filled;
          else daily[s] = filled;
        }),
      );
      return { hourly, daily, weekly };
    },
    staleTime: 5 * 60_000,
  };
}

export function usePortfolioHistory(
  symbols: string[],
  prices: PriceMap | undefined,
  period: HistoryPeriod,
) {
  return useQuery({
    ...portfolioHistoryQuery(symbols, prices, period),
    enabled: symbols.length > 0,
  });
}

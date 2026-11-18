import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getPrices, type PricesResult } from "@/lib/prices.functions";
import { fetchPricesFromBrowser } from "@/lib/market-client";
import { profileQuery, referencesQuery, transactionsQuery } from "@/lib/data";
import { computeAllocation, computeHoldings, computeTotals } from "@/lib/portfolio";
import { normalizeCurrency, type Currency } from "@/lib/format";
import { useUser } from "./use-user";

/** v2: vàng/bạc đổi sang giá SJC (chỉ) / Ancarat (lượng) — bỏ giá ounce cũ đã lưu. */
const PRICE_CACHE = "zth:prices:v2";

function readPriceCache(): PricesResult | null {
  try {
    const raw = localStorage.getItem(PRICE_CACHE);
    return raw ? (JSON.parse(raw) as PricesResult) : null;
  } catch {
    return null;
  }
}


/** Live prices, refreshed every minute; falls back to the last known prices when offline.
 *  Tách riêng thành pricesQuery để màn hình chờ (boot) prefetch được giá
 *  cùng lúc với giao dịch/hồ sơ — vào app rồi thì Trang chủ có sẵn giá,
 *  không phải chờ tải. */
export const pricesQuery = queryOptions({
  queryKey: ["prices"],
  queryFn: async (): Promise<PricesResult> => {
    const cached = readPriceCache();
    const stale = (c: PricesResult): PricesResult => ({
      ...c,
      error: "Đang dùng giá đã lưu gần nhất (chưa tải được giá mới).",
    });
    let res: PricesResult;
    try {
      res = await getPrices();
    } catch (e) {
      // Server Lovable không lấy được giá (bị chặn/rate-limit) thì lấy
      // trực tiếp từ trình duyệt (CoinGecko); vẫn lỗi nữa mới dùng giá lưu.
      try {
        res = await fetchPricesFromBrowser();
      } catch {
        if (cached) return stale(cached);
        throw e;
      }
    }
    if (res.error) {
      try {
        const direct = await fetchPricesFromBrowser();
        // Giữ giá vàng/bạc server đã lấy được (trình duyệt không lấy được SJC/Ancarat).
        if (!direct.error) res = { ...direct, prices: { ...res.prices, ...direct.prices } };
      } catch {
        // Giữ nguyên lỗi của server, rơi xuống giá lưu ở dưới.
      }
      return cached ? stale(cached) : res;
    }
    localStorage.setItem(
      PRICE_CACHE,
      JSON.stringify({
        ...res,
        prices: { ...(cached?.prices ?? {}), ...res.prices },
        usdVnd: res.usdVnd ?? cached?.usdVnd ?? null,
        usdKrw: res.usdKrw ?? cached?.usdKrw ?? null,
      }),
    );
    return res;
  },
  staleTime: 30_000,
  refetchInterval: 60_000,
  placeholderData: (prev) => prev,
});

export function usePrices() {
  return useQuery(pricesQuery);
}

export function useProfile() {
  const user = useUser();
  return useQuery(profileQuery(user.id));
}

export function useCurrency(): Currency {
  const { data } = useProfile();
  return normalizeCurrency(data?.currency);
}

export function useTransactions() {
  const user = useUser();
  return useQuery(transactionsQuery(user.id));
}

export function useReferences() {
  const user = useUser();
  return useQuery(referencesQuery(user.id));
}

/** Live portfolio: holdings, totals and allocation recalculated whenever transactions or prices change. */
export function usePortfolio() {
  const txs = useTransactions();
  const prices = usePrices();
  return useMemo(() => {
    const holdings = computeHoldings(txs.data ?? [], prices.data?.prices ?? {});
    const totals = computeTotals(holdings);
    const allocation = computeAllocation(holdings);
    return {
      txs,
      prices,
      holdings,
      totals,
      allocation,
      usdVnd: prices.data?.usdVnd ?? null,
      usdKrw: prices.data?.usdKrw ?? null,
    };
  }, [txs, prices]);
}

/** Converts a USD amount to the display currency (USDT ≈ USD 1:1). */
export function convertUsd(
  usd: number | null,
  currency: Currency,
  usdVnd: number | null,
  usdKrw?: number | null,
): number | null {
  if (usd == null) return null;
  if (currency === "USDT") return usd;
  if (currency === "KRW") return usdKrw ? usd * usdKrw : null;
  return usdVnd ? usd * usdVnd : null;
}

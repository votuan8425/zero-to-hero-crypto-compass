import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getPrices, type PricesResult } from "@/lib/prices.functions";
import { profileQuery, referencesQuery, transactionsQuery } from "@/lib/data";
import { computeAllocation, computeHoldings, computeTotals } from "@/lib/portfolio";
import { normalizeCurrency, type Currency } from "@/lib/format";
import { useUser } from "./use-user";

const PRICE_CACHE = "zth:prices";

function readPriceCache(): PricesResult | null {
  try {
    const raw = localStorage.getItem(PRICE_CACHE);
    return raw ? (JSON.parse(raw) as PricesResult) : null;
  } catch {
    return null;
  }
}

/** Live prices, refreshed every minute; falls back to the last known prices when offline. */
export function usePrices() {
  return useQuery({
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
        if (cached) return stale(cached);
        throw e;
      }
      if (res.error) return cached ? stale(cached) : res;
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

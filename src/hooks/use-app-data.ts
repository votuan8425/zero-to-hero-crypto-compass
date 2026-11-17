import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getPrices, type PricesResult } from "@/lib/prices.functions";
import { profileQuery, referencesQuery, transactionsQuery } from "@/lib/data";
import { computeAllocation, computeHoldings, computeTotals } from "@/lib/portfolio";
import type { Currency } from "@/lib/format";
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
export function usePrices(symbols: string[]) {
  const key = [...new Set(symbols)].sort();
  return useQuery({
    queryKey: ["prices", ...key],
    queryFn: async (): Promise<PricesResult> => {
      const cached = readPriceCache();
      const stale = (c: PricesResult): PricesResult => ({
        ...c,
        error: "Đang dùng giá đã lưu gần nhất (chưa tải được giá mới).",
      });
      let res: PricesResult;
      try {
        res = await getPrices({ data: { symbols: key } });
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
  return data?.currency ?? "VND";
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
  const symbols = useMemo(() => [...new Set((txs.data ?? []).map((t) => t.symbol))], [txs.data]);
  const prices = usePrices(symbols);
  return useMemo(() => {
    const holdings = computeHoldings(txs.data ?? [], prices.data?.prices ?? {});
    const totals = computeTotals(holdings);
    const allocation = computeAllocation(holdings);
    return { txs, prices, holdings, totals, allocation, usdVnd: prices.data?.usdVnd ?? null };
  }, [txs, prices]);
}

/** Converts a USD amount to the display currency. */
export function convertUsd(
  usd: number | null,
  currency: Currency,
  usdVnd: number | null,
): number | null {
  if (usd == null) return null;
  if (currency === "USD") return usd;
  return usdVnd ? usd * usdVnd : null;
}

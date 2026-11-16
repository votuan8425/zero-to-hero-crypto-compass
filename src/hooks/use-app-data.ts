import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getPrices } from "@/lib/prices.functions";
import { profileQuery, referencesQuery, transactionsQuery } from "@/lib/data";
import { computeAllocation, computeHoldings, computeTotals } from "@/lib/portfolio";
import type { Currency } from "@/lib/format";
import { useUser } from "./use-user";

export function usePrices(symbols: string[]) {
  const key = [...new Set(symbols)].sort();
  return useQuery({
    queryKey: ["prices", ...key],
    queryFn: () => getPrices({ data: { symbols: key } }),
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
export function convertUsd(usd: number | null, currency: Currency, usdVnd: number | null): number | null {
  if (usd == null) return null;
  if (currency === "USD") return usd;
  return usdVnd ? usd * usdVnd : null;
}

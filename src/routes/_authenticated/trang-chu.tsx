import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarCheck,
  CloudUpload,
  Coins,
  Flame,
  Layers,
  Plus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { CoinLogo } from "@/components/app/coin-logo";
import { PnlText, Stat } from "@/components/app/stat";
import { convertUsd, useCurrency, usePortfolio, useProfile } from "@/hooks/use-app-data";
import { computeStreak } from "@/lib/portfolio";
import { GOLD_SYMBOL } from "@/lib/prices.functions";
import type { PriceMap } from "@/lib/portfolio";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { displaySymbol } from "@/lib/coins";
import { scanLegacyData } from "@/lib/legacy-migration";

export const Route = createFileRoute("/_authenticated/trang-chu")({
  head: () => ({
    meta: [
      { title: "Trang chủ — ZERO TO HERO" },
      {
        name: "description",
        content: "Tổng tài sản, lãi/lỗ và tài sản đang nắm giữ của bạn.",
      },
      { property: "og:title", content: "Trang chủ — ZERO TO HERO" },
      { property: "og:description", content: "Tổng quan danh mục tích sản của bạn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const currency = useCurrency();
  const { data: profile } = useProfile();
  const { txs, prices, holdings, totals, usdVnd } = usePortfolio();
  const legacy = useQuery({
    queryKey: ["legacy-scan"],
    queryFn: scanLegacyData,
    staleTime: Infinity,
  });
  const streak = computeStreak((txs.data ?? []).map((t) => t.tx_date));
  const money = (usd: number | null, compact = false) =>
    formatMoney(convertUsd(usd, currency, usdVnd), currency, { compact });

  const showLegacy = (legacy.data?.length ?? 0) > 0 && !profile?.local_migrated_at;

  return (
    <div>
      <PageHeader
        title={`Xin chào${profile?.display_name ? `, ${profile.display_name}` : ""}`}
        subtitle={formatDate(new Date(), "long")}
        action={
          <Button asChild variant="hero">
            <Link to="/tich-san" search={{ add: true }}>
              <Plus /> Tích sản
            </Link>
          </Button>
        }
      />

      {showLegacy && (
        <Link
          to="/ca-nhan"
          hash="chuyen-du-lieu"
          className="mb-4 flex items-center gap-3 rounded-xl border border-info/40 bg-info/10 p-4 text-sm text-info"
        >
          <CloudUpload className="h-5 w-5 shrink-0" />
          <span className="flex-1">
            Tìm thấy {legacy.data?.length} giao dịch cũ lưu trên trình duyệt này. Chuyển chúng lên
            đám mây để không bị mất.
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <section className="panel hero-glow relative overflow-hidden p-5 md:p-7">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tổng tài sản
        </div>
        {txs.isLoading ? (
          <Skeleton className="mt-3 h-10 w-56" />
        ) : (
          <div className="num mt-2 text-3xl font-bold tracking-tight md:text-5xl">
            {totals.valueUsd != null
              ? money(totals.valueUsd)
              : holdings.length === 0
                ? money(0)
                : "—"}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Lãi / Lỗ: </span>
            <PnlText value={totals.pnlUsd} className="font-semibold">
              {totals.pnlUsd != null
                ? `${totals.pnlUsd >= 0 ? "+" : ""}${money(totals.pnlUsd)} (${formatPercent(totals.pnlPct, 2, true)})`
                : "—"}
            </PnlText>
          </div>
          <div>
            <span className="text-muted-foreground">Vốn đã tích sản: </span>
            <span className="num font-medium">{money(totals.investedUsd)}</span>
          </div>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          {prices.data?.error
            ? prices.data.error
            : prices.data
              ? `Giá cập nhật lúc ${formatDateTime(prices.data.fetchedAt)}${currency === "VND" && usdVnd ? ` · 1 USD ≈ ${formatNumber(usdVnd, 0)} ₫` : ""}`
              : "Đang tải giá thị trường…"}
        </div>
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={<Flame className="h-3.5 w-3.5 text-primary" />}
          label="Chuỗi tích sản"
          value={`${streak.current} ngày`}
          hint={`Dài nhất: ${streak.longest} ngày`}
        />
        <Stat
          icon={<CalendarCheck className="h-3.5 w-3.5" />}
          label="Ngày tích sản"
          value={streak.activeDays}
          hint={streak.lastDate ? `Gần nhất: ${formatDate(streak.lastDate)}` : "Chưa có"}
        />
        <Stat
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Số lần mua"
          value={txs.data?.length ?? 0}
        />
        <Stat
          icon={<Coins className="h-3.5 w-3.5" />}
          label="Số loại coin"
          value={holdings.length}
        />
      </div>

      <MarketPrices prices={prices.data?.prices} loading={prices.isLoading} money={money} />

      {holdings.length === 0 && !txs.isLoading ? (
        <div className="mt-6">
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title="Bạn chưa có giao dịch tích sản nào"
            description="Ghi lại lần mua đầu tiên để bắt đầu theo dõi tổng tài sản, lãi/lỗ và chuỗi tích sản."
            action={
              <Button asChild variant="hero">
                <Link to="/tich-san" search={{ add: true }}>
                  <Plus /> Thêm lần mua đầu tiên
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-6">
          <section className="panel overflow-hidden">
            <h2 className="px-5 pt-5 text-sm font-semibold uppercase tracking-wider">
              Tài sản đang nắm giữ
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {holdings.map((h) => (
                <li key={h.symbol} className="flex items-center gap-3 px-5 py-3.5">
                  <CoinLogo symbol={h.symbol} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold">{displaySymbol(h.symbol)}</span>
                      <span className="truncate text-xs text-muted-foreground">{h.name}</span>
                    </div>
                    <div className="num text-xs text-muted-foreground">
                      {formatNumber(h.quantity)} · Giá vốn TB {money(h.avgCostUsd)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num font-semibold">{money(h.valueUsd ?? null)}</div>
                    <PnlText value={h.pnlUsd} className="text-xs">
                      {h.pnlUsd != null
                        ? `${h.pnlUsd >= 0 ? "+" : ""}${money(h.pnlUsd, true)} (${formatPercent(h.pnlPct, 1, true)})`
                        : "Chưa có giá"}
                    </PnlText>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

/**
 * Bảng giá kiểu OKX: BTC, ETH và Vàng (PAXG — 1 PAXG ≈ 1 ounce vàng,
 * giá lấy từ OKX, fallback CoinGecko; xem src/lib/prices.functions.ts).
 * Giá theo đơn vị tiền tệ người dùng đang chọn; vàng tính theo ounce.
 */
function MarketPrices({
  prices,
  loading,
  money,
}: {
  prices: PriceMap | undefined;
  loading: boolean;
  money: (usd: number | null, compact?: boolean) => string;
}) {
  const rows = [
    { symbol: "BTC", name: "Bitcoin", unit: null as string | null },
    { symbol: "ETH", name: "Ethereum", unit: null as string | null },
    { symbol: GOLD_SYMBOL, name: "Vàng", unit: "1 ounce" },
  ];
  return (
    <section className="panel mt-6 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider">Giá thị trường</h2>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">
        Giá từ OKX · Vàng theo PAXG (1 PAXG ≈ 1 ounce)
      </p>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const q = prices?.[r.symbol];
            return (
              <li key={r.symbol} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <CoinLogo symbol={r.symbol} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.symbol === GOLD_SYMBOL ? "PAXG" : displaySymbol(r.symbol)}
                      {r.unit ? ` · ${r.unit}` : ""}
                    </span>
                  </div>
                  <div className="num text-xs text-muted-foreground">
                    {q ? money(q.usd) : "Chưa có giá"}
                  </div>
                </div>
                <div className="text-right">
                  <PnlText value={q?.change24h ?? null} className="text-sm font-semibold">
                    {q?.change24h != null ? formatPercent(q.change24h, 2, true) : "—"}
                  </PnlText>
                  <div className="text-xs text-muted-foreground">24 giờ</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

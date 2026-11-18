import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarCheck,
  CloudUpload,
  Coins,
  Flame,
  Layers,
  Star,
  Wallet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { CoinLogo } from "@/components/app/coin-logo";
import { PortfolioChart } from "@/components/app/portfolio-chart";
import { PriceChartDialog } from "@/components/app/price-chart-dialog";
import { PnlText, Stat } from "@/components/app/stat";
import { convertUsd, useCurrency, usePortfolio, useProfile } from "@/hooks/use-app-data";
import { usePortfolioHistory } from "@/hooks/use-portfolio-history";
import { computeMonthlyStreak, groupByMonth, monthKeyOf, monthLabel } from "@/lib/accumulation";
import type { PriceMap } from "@/lib/portfolio";
import {
  HISTORY_PERIODS,
  computePortfolioHistory,
  historyPeriodDays,
  historyPeriodLabel,
  withLiveEndpoint,
  type HistoryPeriod,
  type HistoryPoint,
} from "@/lib/portfolio-history";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { COINS, displaySymbol, getCoin, quantityUnit } from "@/lib/coins";
import { loadFavorites, saveFavorites, toggleFavorite } from "@/lib/favorites";
import { scanLegacyData } from "@/lib/legacy-migration";
import { cn } from "@/lib/utils";

/** " · 1 USDT ≈ 26.000 ₫" hoặc " · 1 USDT ≈ 1.380 ₩" — USDT thì không cần. */
function rateHint(
  currency: "VND" | "USDT" | "KRW",
  usdVnd: number | null,
  usdKrw: number | null,
): string {
  if (currency === "VND" && usdVnd) return ` · 1 USDT ≈ ${formatNumber(usdVnd, 0)} ₫`;
  if (currency === "KRW" && usdKrw) return ` · 1 USDT ≈ ${formatNumber(usdKrw, 0)} ₩`;
  return "";
}

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
  const { txs, prices, holdings, totals, usdVnd, usdKrw } = usePortfolio();
  const legacy = useQuery({
    queryKey: ["legacy-scan"],
    queryFn: scanLegacyData,
    staleTime: Infinity,
  });
  const monthly = useMemo(
    () => computeMonthlyStreak(txs.data ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txs.data],
  );
  const thisMonth = useMemo(() => {
    const groups = groupByMonth(txs.data ?? []);
    return groups.find((g) => g.key === monthKeyOf(new Date())) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs.data]);
  const money = (usd: number | null, compact = false) =>
    formatMoney(convertUsd(usd, currency, usdVnd, usdKrw), currency, { compact });

  // Biểu đồ xu hướng tổng giá trị tài sản kiểu OKX.
  const [period, setPeriod] = useState<HistoryPeriod>("1M");
  const [hovered, setHovered] = useState<HistoryPoint | null>(null);
  const heldSymbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const historyQuery = usePortfolioHistory(heldSymbols, prices.data?.prices);
  const history = useMemo(() => {
    if (!historyQuery.data) return null;
    const toMs = Date.now();
    const fromMs = toMs - historyPeriodDays(period) * 86_400_000;
    const series = period === "1Y" ? historyQuery.data.weekly : historyQuery.data.daily;
    const h = computePortfolioHistory(txs.data ?? [], series, fromMs, toMs);
    // Chốt điểm cuối bằng tổng giá trị hiện tại để đường chạm đúng số đang hiện.
    return withLiveEndpoint(h, toMs, totals.valueUsd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyQuery.data, period, txs.data, totals.valueUsd]);

  const showLegacy = (legacy.data?.length ?? 0) > 0 && !profile?.local_migrated_at;

  return (
    <div>
      <PageHeader
        title={`Xin chào${profile?.display_name ? `, ${profile.display_name}` : ""}`}
        subtitle={formatDate(new Date(), "long")}
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
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tổng giá trị ước tính
            </div>
            {txs.isLoading ? (
              <Skeleton className="mt-3 h-10 w-56" />
            ) : (
              <div
                className={cn(
                  "num mt-2 font-bold tracking-tight",
                  holdings.length === 0
                    ? "text-3xl md:text-5xl"
                    : "text-2xl sm:text-3xl md:text-4xl xl:text-5xl",
                )}
              >
                {hovered != null && history && history.points.length > 0
                  ? money(hovered.value)
                  : totals.valueUsd != null
                    ? money(totals.valueUsd)
                    : holdings.length === 0
                      ? money(0)
                      : "—"}
              </div>
            )}
            <div className="mt-2 text-sm">
              {hovered != null ? (
                <span className="text-muted-foreground">{formatDateTime(hovered.t)}</span>
              ) : history && history.points.length > 0 ? (
                <>
                  <div>
                    <span className="text-muted-foreground">
                      PNL trong {historyPeriodLabel(period)}{" "}
                    </span>
                    <PnlText value={history.pnl} className="font-semibold">
                      {`${history.pnl >= 0 ? "+" : ""}${money(history.pnl)} (${formatPercent(history.pnlPct, 2, true)})`}
                    </PnlText>
                  </div>
                  {history.deposits > 0 && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Đã mua thêm {money(history.deposits)} trong {historyPeriodLabel(period)}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">
                  PNL trong {historyPeriodLabel(period)} —
                </span>
              )}
            </div>
          </div>
          {holdings.length > 0 && (
            <div className="aspect-[2/1] w-[46%] shrink-0 sm:w-[48%] md:w-[52%]">
              {txs.isLoading || historyQuery.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : history && history.points.length > 0 ? (
                <PortfolioChart points={history.points} onHover={setHovered} />
              ) : (
                <p className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
                  {historyQuery.isError
                    ? "Không tải được lịch sử giá."
                    : "Chưa có dữ liệu lịch sử."}
                </p>
              )}
            </div>
          )}
        </div>
        {holdings.length > 0 && (
          <div className="mt-1 flex justify-center">
            <ToggleGroup
              type="single"
              size="sm"
              value={period}
              onValueChange={(v) => {
                if (!v) return;
                setPeriod(v as HistoryPeriod);
                setHovered(null);
              }}
              className="gap-0 rounded-full bg-muted p-1"
            >
              {HISTORY_PERIODS.map((p) => (
                <ToggleGroupItem
                  key={p}
                  value={p}
                  className="h-8 rounded-full px-3 text-xs font-medium hover:bg-background/70 hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
                >
                  {p}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
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
              ? `Giá cập nhật lúc ${formatDateTime(prices.data.fetchedAt)}${rateHint(currency, usdVnd, usdKrw)}`
              : "Đang tải giá thị trường…"}
        </div>
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={<Flame className="h-3.5 w-3.5 text-primary" />}
          label="Tháng đã tích"
          value={`${monthly.months} tháng`}
          hint={
            monthly.months > 0
              ? `Chuỗi tháng dài nhất: ${monthly.longest} tháng`
              : "Chưa có tháng nào"
          }
        />
        <Stat
          icon={<CalendarCheck className="h-3.5 w-3.5" />}
          label="Tháng này"
          value={`${monthly.currentMonthBuys} lần mua`}
          hint={
            thisMonth
              ? `Tổng vốn: ${money(thisMonth.investedUsd)}`
              : monthly.latestMonth
                ? `Gần nhất: ${monthLabel(monthly.latestMonth)}`
                : "Chưa có giao dịch"
          }
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

      <MarketPrices
        prices={prices.data?.prices}
        loading={prices.isLoading}
        money={money}
        currency={currency}
        usdVnd={usdVnd}
        usdKrw={usdKrw}
      />

      {holdings.length === 0 && !txs.isLoading ? (
        <div className="mt-6">
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title="Bạn chưa có giao dịch tích sản nào"
            description="Mở tab Tích sản để ghi lại lần mua đầu tiên và bắt đầu theo dõi tổng tài sản, lãi/lỗ và chuỗi tích sản."
          />
        </div>
      ) : (
        <div className="mt-6">
          <section className="panel overflow-hidden">
            <h2 className="px-5 pt-5 text-sm font-semibold uppercase tracking-wider">
              Tài sản đang nắm giữ
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {holdings.map((h) => {
                const unit = getCoin(h.symbol)?.unit;
                // Vàng/bạc luôn hiển thị bằng VND (vốn VND chính xác nếu có).
                const toVnd = (usd: number | null) => (usd != null && usdVnd ? usd * usdVnd : null);
                const fmt = (v: number | null, compact = false) =>
                  formatMoney(v, "VND", { compact });
                const avg = unit ? fmt(h.avgCostVnd ?? toVnd(h.avgCostUsd)) : money(h.avgCostUsd);
                const cur = unit
                  ? fmt(prices.data?.prices[h.symbol]?.vnd ?? null)
                  : h.priceUsd != null
                    ? money(h.priceUsd)
                    : null;
                const value = unit ? fmt(h.valueVnd ?? toVnd(h.valueUsd)) : money(h.valueUsd ?? null);
                const pnl = unit ? (h.pnlVnd ?? toVnd(h.pnlUsd)) : h.pnlUsd;
                const pnlText =
                  pnl == null
                    ? "Chưa có giá"
                    : `${pnl >= 0 ? "+" : ""}${unit ? fmt(pnl, true) : money(pnl, true)} (${formatPercent(h.pnlPct, 1, true)})`;
                return (
                <li key={h.symbol} className="flex items-center gap-3 px-5 py-3.5">
                  <CoinLogo symbol={h.symbol} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold">{displaySymbol(h.symbol)}</span>
                      {!unit && (
                        <span className="truncate text-xs text-muted-foreground">{h.name}</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="num inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
                        Avg {avg}
                        {unit ? ` / ${unit}` : ""}
                      </span>
                      {cur != null && cur !== "—" && (
                        <span className="num text-xs text-muted-foreground">Hiện tại {cur}</span>
                      )}
                    </div>
                    <div className="num mt-1 text-xs text-muted-foreground">
                      {formatNumber(h.quantity)} {quantityUnit(h.symbol)} · {h.purchases} lần mua
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num font-semibold">{value}</div>
                    <PnlText value={pnl} className="text-xs">
                      {pnlText}
                    </PnlText>
                  </div>
                </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

/**
 * Bảng giá kiểu OKX: toàn bộ coin hỗ trợ, kéo cuộn để xem hết. Bấm ngôi sao
 * để ghim tối đa 3 coin yêu thích lên đầu (mặc định BTC, ETH, Vàng — lưu trên
 * thiết bị này). Bấm vào một coin để mở popup biểu đồ theo ngày / tháng / năm.
 * Vàng theo giá SJC mỗi chỉ, bạc theo giá Ancarat mỗi lượng (mua vào · bán ra).
 */
function MarketPrices({
  prices,
  loading,
  money,
  currency,
  usdVnd,
  usdKrw,
}: {
  prices: PriceMap | undefined;
  loading: boolean;
  money: (usd: number | null, compact?: boolean) => string;
  currency: "VND" | "USDT" | "KRW";
  usdVnd: number | null;
  usdKrw: number | null;
}) {
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);

  const rows = useMemo(() => {
    const favSet = new Set(favorites);
    const favRows = favorites
      .map((s) => COINS.find((c) => c.symbol === s))
      .filter((c): c is (typeof COINS)[number] => !!c);
    const rest = COINS.filter((c) => !favSet.has(c.symbol));
    return [...favRows, ...rest];
  }, [favorites]);

  function onToggleStar(symbol: string) {
    const res = toggleFavorite(symbol, favorites);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setFavorites(res.list);
    saveFavorites(res.list);
  }

  return (
    <section className="panel mt-6 p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider">Giá thị trường</h2>
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : (
        <ul className="max-h-[232px] divide-y divide-border overflow-y-scroll scroll-thin pr-1">
          {rows.map((c) => {
            const q = prices?.[c.symbol];
            const isFav = favorites.includes(c.symbol);
            return (
              <li key={c.symbol}>
                <button
                  type="button"
                  onClick={() => setChartSymbol(c.symbol)}
                  className="block w-full py-4 text-left transition-colors hover:bg-surface-raised/40"
                  aria-label={`Xem biểu đồ ${c.name}`}
                >
                  <div className="flex items-center gap-3">
                    <CoinLogo symbol={c.symbol} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.unit ? `1 ${c.unit}` : displaySymbol(c.symbol)}
                        </span>
                      </div>
                      {!c.unit && (
                        <div className="num text-xs text-muted-foreground">
                          {q ? money(q.usd) : "Chưa có giá"}
                        </div>
                      )}
                    </div>
                  <div className="text-right">
                    <PnlText value={q?.change24h ?? null} className="text-sm font-semibold">
                      {q?.change24h != null ? formatPercent(q.change24h, 2, true) : "—"}
                    </PnlText>
                    <div className="text-xs text-muted-foreground">24 giờ</div>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={isFav ? `Bỏ ghim ${c.name}` : `Ghim ${c.name} lên đầu`}
                    aria-pressed={isFav}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar(c.symbol);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleStar(c.symbol);
                      }
                    }}
                    className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-surface-raised"
                  >
                    <Star
                      className={cn(
                        "h-5 w-5",
                        isFav ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
                      )}
                    />
                  </span>
                  </div>
                  {c.unit != null && (
                    <div className="num mt-2 whitespace-nowrap pl-[48px] text-[11px]">
                      {!q ? (
                        <span className="text-muted-foreground">Chưa có giá</span>
                      ) : q.askVnd != null ? (
                        <>
                          <span className="font-semibold text-gain">
                            {formatNumber(q.vnd, 0)} vnđ
                          </span>
                          {" / "}
                          <span className="font-semibold text-loss">
                            {formatNumber(q.askVnd, 0)} vnđ
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          {formatNumber(q.vnd, 0)} vnđ
                        </span>
                      )}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <PriceChartDialog
        open={chartSymbol !== null}
        onOpenChange={(v) => !v && setChartSymbol(null)}
        symbol={chartSymbol}
        money={money}
        currency={currency}
        usdVnd={usdVnd}
        usdKrw={usdKrw}
        quote={chartSymbol ? prices?.[chartSymbol] : undefined}
      />
    </section>
  );
}

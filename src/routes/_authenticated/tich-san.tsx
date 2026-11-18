import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { CoinLogo } from "@/components/app/coin-logo";
import { DonutChart } from "@/components/app/donut-chart";
import { Stat } from "@/components/app/stat";
import { TransactionDialog } from "@/components/app/transaction-dialog";
import { useSync } from "@/components/app/sync-provider";
import { convertUsd, useCurrency, usePortfolio } from "@/hooks/use-app-data";
import { useUser } from "@/hooks/use-user";
import { deleteTransaction } from "@/lib/data";
import { readQueue } from "@/lib/offline-queue";
import {
  computeMonthlyStreak,
  groupByMonth,
  monthLabel,
  yearTotals,
  type MonthGroup,
} from "@/lib/accumulation";
import type { Tx } from "@/lib/portfolio";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { getCoin, quantityUnit } from "@/lib/coins";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tich-san")({
  validateSearch: (s: Record<string, unknown>): { add?: boolean } =>
    s["add"] === true || s["add"] === "true" ? { add: true } : {},
  head: () => ({
    meta: [
      { title: "Tích sản — ZERO TO HERO" },
      {
        name: "description",
        content: "Ghi lại các lần mua định kỳ, tích lũy theo tháng và năm của bạn.",
      },
      { property: "og:title", content: "Tích sản — ZERO TO HERO" },
      {
        property: "og:description",
        content: "Tích lũy theo tháng, theo năm và lịch sử giao dịch.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccumulatePage,
});

/**
 * Tích lũy theo tháng / năm — tích sản không phải chuyện của ngày nên trang
 * này nhìn theo tháng và năm: biểu đồ 12 cột vốn theo tháng, chọn tháng để
 * xem chi tiết, lịch sử nhóm theo tháng. Chuỗi ngày chỉ còn là 2 chỉ số nhỏ.
 */
function AccumulatePage() {
  const user = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const currency = useCurrency();
  const { pending } = useSync();
  const { txs, totals, allocation, holdings, usdVnd, usdKrw } = usePortfolio();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [toDelete, setToDelete] = useState<Tx | null>(null);

  useEffect(() => {
    if (search.add) {
      setEditing(null);
      setOpen(true);
      void navigate({ to: "/tich-san", search: {}, replace: true });
    }
  }, [search.add, navigate]);

  const list = txs.data ?? [];
  const monthly = useMemo(() => computeMonthlyStreak(list), [list]);
  const groups = useMemo(() => groupByMonth(list), [list]);
  const pendingIds = useMemo(
    () => new Set(readQueue(user.id).map((o) => o.id)),
    [user.id, pending, list],
  );

  const thisYear = new Date().getFullYear();
  const firstYear = groups.length > 0 ? groups[groups.length - 1]?.year ?? thisYear : thisYear;
  const [year, setYear] = useState(thisYear);
  const yearGroups = useMemo(() => groups.filter((g) => g.year === year), [groups, year]);
  const yearTotal = useMemo(() => yearTotals(groups, year), [groups, year]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Tháng được bấm trực tiếp — chỉ tháng này mới hiện bảng chi tiết.
  const [clickedKey, setClickedKey] = useState<string | null>(null);
  const selected: MonthGroup | null =
    yearGroups.find((g) => g.key === selectedKey) ??
    yearGroups.find((g) => g.key === `${thisYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`) ??
    yearGroups[0] ??
    null;
  const maxMonth = Math.max(0, ...yearGroups.map((g) => g.investedUsd));

  const money = (usd: number | null) =>
    formatMoney(convertUsd(usd, currency, usdVnd, usdKrw), currency);
  const avg = list.length ? totals.investedUsd / list.length : null;

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      const s = await deleteTransaction(qc, user.id, toDelete);
      toast.success(
        s === "queued" ? "Đã xoá trên thiết bị. Sẽ đồng bộ khi có mạng." : "Đã xoá giao dịch.",
      );
    } catch {
      toast.error("Không xoá được giao dịch. Vui lòng thử lại.");
    } finally {
      setToDelete(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Tích sản"
        subtitle="Mua đều đặn, kiên nhẫn nắm giữ."
        action={
          <Button
            variant="hero"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> Thêm lần mua
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider">
                Tích lũy theo tháng
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Năm {year} · {yearTotal.buys} lần mua · Tổng vốn {money(yearTotal.investedUsd)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Năm trước"
                disabled={year <= firstYear - 5}
                onClick={() => {
                  setYear(year - 1);
                  setSelectedKey(null);
                  setClickedKey(null);
                }}
              >
                <ChevronLeft />
              </Button>
              <span className="num min-w-14 text-center text-sm font-semibold">{year}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Năm sau"
                disabled={year >= thisYear}
                onClick={() => {
                  setYear(year + 1);
                  setSelectedKey(null);
                  setClickedKey(null);
                }}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>

          {yearGroups.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Chưa có lần mua nào trong năm {year}.
            </div>
          ) : (
            <>
              <div className="flex h-28 items-end gap-1.5">
                {Array.from({ length: 12 }, (_, i) => {
                  const m = i + 1;
                  const key = `${year}-${String(m).padStart(2, "0")}`;
                  const g = yearGroups.find((x) => x.month === m);
                  const h = g && maxMonth > 0 ? Math.max(6, (g.investedUsd / maxMonth) * 100) : 0;
                  const isSel = selected?.key === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedKey(key);
                        setClickedKey((prev) => (prev === key ? null : key));
                      }}
                      disabled={!g}
                      aria-label={
                        g
                          ? `${monthLabel(key)}: ${g.buys} lần mua, ${money(g.investedUsd)}`
                          : `Tháng ${m}: chưa có giao dịch`
                      }
                      className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                    >
                      {clickedKey === key && g && (
                        <span
                          className={cn(
                            "absolute top-0 z-20 whitespace-nowrap rounded-lg border border-border bg-surface-raised px-3 py-2 text-left shadow-lg",
                            i <= 1
                              ? "left-0"
                              : i >= 10
                                ? "right-0"
                                : "left-1/2 -translate-x-1/2",
                          )}
                        >
                          <span className="block text-xs font-bold">{monthLabel(key)}</span>
                          <span className="num mt-0.5 block text-xs text-muted-foreground">
                            {g.buys} lần mua · {money(g.investedUsd)}
                          </span>
                          <span className="num block text-xs text-muted-foreground">
                            Avg {money(g.buys ? g.investedUsd / g.buys : null)}/lần
                          </span>
                        </span>
                      )}
                      <span className="num text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        {g ? g.buys : ""}
                      </span>
                      <span
                        className={cn(
                          "w-full rounded-t-md transition-colors",
                          g
                            ? clickedKey === key
                              ? "bg-[oklch(0.62_0.19_135)] ring-2 ring-white/90"
                              : isSel
                                ? "lime-gradient"
                                : "bg-primary/60 group-hover:bg-primary"
                            : "bg-surface-raised",
                        )}
                        style={{ height: `${h}%` }}
                      />
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          isSel ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        T{m}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selected && (
                <div className="mt-4 rounded-lg bg-surface-raised px-4 py-3">
                  <div className="text-xs text-muted-foreground">{monthLabel(selected.key)}</div>
                  <div className="num mt-0.5 text-lg font-bold">
                    {money(selected.investedUsd)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {selected.buys} lần mua · Avg{" "}
                    {money(selected.buys ? selected.investedUsd / selected.buys : null)}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Bấm vào cột để xem tháng khác
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat
              icon={<Wallet className="h-3.5 w-3.5" />}
              label="Tổng vốn"
              value={money(totals.investedUsd)}
            />
            <Stat
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Avg mỗi lần"
              value={money(avg)}
              hint={`${list.length} lần mua`}
            />
            <Stat
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Số tháng đã tích"
              value={`${monthly.months} tháng`}
              hint={
                monthly.firstMonth
                  ? `Từ ${monthLabel(monthly.firstMonth)}`
                  : "Chưa có tháng nào"
              }
            />
            <Stat
              icon={<Trophy className="h-3.5 w-3.5" />}
              label="Chuỗi tháng dài nhất"
              value={`${monthly.longest} tháng`}
              hint={
                monthly.current > 0
                  ? `Chuỗi hiện tại: ${monthly.current} tháng`
                  : "Chưa có chuỗi đang chạy"
              }
            />
          </div>

          {holdings.length > 0 && (
            <section className="panel p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider">Phân bổ danh mục</h2>
              <p className="mb-3 mt-1 text-xs text-muted-foreground">
                {allocation.basis === "value"
                  ? "Theo giá trị hiện tại"
                  : "Theo vốn đã bỏ ra (chưa có đủ giá thị trường)"}
              </p>
              <DonutChart
                items={allocation.slices}
                centerValue={String(holdings.length)}
                centerLabel="loại coin"
                height={180}
              />
            </section>
          )}
        </div>
      </div>

      <section className="panel mt-4 overflow-hidden">
        <h2 className="px-5 pt-5 text-sm font-semibold uppercase tracking-wider">
          Lịch sử tích sản
        </h2>
        {txs.isLoading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : list.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Plus className="h-6 w-6" />}
              title="Chưa có giao dịch"
              description="Bấm “Thêm lần mua” để ghi lại lần tích sản đầu tiên."
            />
          </div>
        ) : (
          <div className="mt-2">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 bg-surface-raised/60 px-5 py-1.5 text-xs font-medium text-muted-foreground">
                  <span className="capitalize text-foreground">{monthLabel(g.key)}</span>
                  <span className="num">
                    {g.buys} lần mua · {money(g.investedUsd)}
                  </span>
                </div>
                {[...groupByDate(g.txs)].map(([date, items]) => (
                  <div key={date}>
                    <div className="px-5 pt-3 text-xs font-medium capitalize text-muted-foreground">
                      {formatDate(date, "long")}
                    </div>
                    <ul className="divide-y divide-border">
                      {items.map((t) => (
                        <li key={t.id} className="flex items-center gap-2 px-4 py-3">
                          <CoinLogo symbol={t.symbol} size={32} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="num font-semibold">
                                +{formatNumber(t.quantity)} {quantityUnit(t.symbol)}
                              </span>
                              {pendingIds.has(t.id) && (
                                <Badge
                                  variant="outline"
                                  className="border-info/50 text-[10px] text-info"
                                >
                                  Chờ đồng bộ
                                </Badge>
                              )}
                            </div>
                            <div className="num whitespace-nowrap overflow-hidden text-xs text-muted-foreground">
                              {getCoin(t.symbol)?.unit ? (
                                // Vàng/bạc luôn hiển thị bằng VND (giá VND chính xác nếu có).
                                <>
                                  Giá {formatMoney(t.price_vnd ?? (usdVnd ? t.price_usd * usdVnd : null), "VND")}{" "}
                                  · Tổng{" "}
                                  {formatMoney(
                                    t.price_vnd != null
                                      ? t.quantity * t.price_vnd + (t.fee_vnd ?? 0)
                                      : usdVnd
                                        ? (t.quantity * t.price_usd + t.fee_usd) * usdVnd
                                        : null,
                                    "VND",
                                  )}
                                </>
                              ) : (
                                <>
                                  Giá {money(t.price_usd)} · Tổng{" "}
                                  {money(t.quantity * t.price_usd + t.fee_usd)}
                                </>
                              )}
                              {t.note ? ` · ${t.note}` : ""}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Sửa giao dịch"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditing(t);
                              setOpen(true);
                            }}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Xoá giao dịch"
                            className="h-8 w-8 text-muted-foreground hover:text-loss"
                            onClick={() => setToDelete(t)}
                          >
                            <Trash2 />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <TransactionDialog
        open={open}
        onOpenChange={setOpen}
        existing={editing}
        defaultCurrency={currency}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá giao dịch này?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete &&
                `${formatNumber(toDelete.quantity)} ${quantityUnit(toDelete.symbol)} ngày ${formatDate(toDelete.tx_date)}. `}
              Thao tác này sẽ xoá trên mọi thiết bị và không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Nhóm các giao dịch trong một tháng theo ngày (mới nhất trước). */
function groupByDate(txs: Tx[]): [string, Tx[]][] {
  const g = new Map<string, Tx[]>();
  for (const t of txs) g.set(t.tx_date, [...(g.get(t.tx_date) ?? []), t]);
  return [...g.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

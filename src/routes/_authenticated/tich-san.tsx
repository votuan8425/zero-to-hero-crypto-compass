import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Clock, Flame, Pencil, Plus, Trash2, Trophy, Wallet } from "lucide-react";
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
import { Stat } from "@/components/app/stat";
import { StreakCalendar } from "@/components/app/streak-calendar";
import { TransactionDialog } from "@/components/app/transaction-dialog";
import { useSync } from "@/components/app/sync-provider";
import { convertUsd, useCurrency, usePortfolio } from "@/hooks/use-app-data";
import { useUser } from "@/hooks/use-user";
import { deleteTransaction } from "@/lib/data";
import { readQueue } from "@/lib/offline-queue";
import { computeStreak, type Tx } from "@/lib/portfolio";
import { formatDate, formatMoney, formatNumber, parseDateOnly, toDateKey } from "@/lib/format";
import { displaySymbol } from "@/lib/coins";

export const Route = createFileRoute("/_authenticated/tich-san")({
  validateSearch: (s: Record<string, unknown>): { add?: boolean } =>
    s["add"] === true || s["add"] === "true" ? { add: true } : {},
  head: () => ({
    meta: [
      { title: "Tích sản — ZERO TO HERO" },
      {
        name: "description",
        content: "Ghi lại các lần mua định kỳ, chuỗi tích sản và lịch tích sản của bạn.",
      },
      { property: "og:title", content: "Tích sản — ZERO TO HERO" },
      {
        property: "og:description",
        content: "Chuỗi tích sản, lịch tích sản và lịch sử giao dịch.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccumulatePage,
});

function AccumulatePage() {
  const user = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const currency = useCurrency();
  const { pending } = useSync();
  const { txs, totals, usdVnd } = usePortfolio();
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
  const streak = computeStreak(list.map((t) => t.tx_date));
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of list) {
      const k = toDateKey(parseDateOnly(t.tx_date));
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [list]);
  const pendingIds = useMemo(
    () => new Set(readQueue(user.id).map((o) => o.id)),
    [user.id, pending, list],
  );
  const groups = useMemo(() => {
    const g = new Map<string, Tx[]>();
    for (const t of list) g.set(t.tx_date, [...(g.get(t.tx_date) ?? []), t]);
    return [...g.entries()];
  }, [list]);
  const money = (usd: number | null) => formatMoney(convertUsd(usd, currency, usdVnd), currency);
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="panel p-5">
          <div className="mb-5 flex items-center gap-4">
            <div className="lime-gradient grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-primary-foreground shadow-glow">
              <Flame className="h-8 w-8" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Chuỗi tích sản
              </div>
              <div className="num text-3xl font-bold">
                {streak.current}{" "}
                <span className="text-base font-medium text-muted-foreground">ngày</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {streak.boughtToday
                  ? "Bạn đã tích sản hôm nay 🎯"
                  : streak.current > 0
                    ? "Tích sản hôm nay để giữ chuỗi!"
                    : "Bắt đầu chuỗi mới ngay hôm nay."}
              </div>
            </div>
          </div>
          <StreakCalendar counts={counts} />
        </section>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat
              icon={<Trophy className="h-3.5 w-3.5" />}
              label="Chuỗi dài nhất"
              value={`${streak.longest} ngày`}
            />
            <Stat
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Tổng ngày tích sản"
              value={streak.activeDays}
            />
            <Stat
              icon={<Wallet className="h-3.5 w-3.5" />}
              label="Tổng vốn"
              value={money(totals.investedUsd)}
              valueClassName="text-lg md:text-xl"
            />
            <Stat
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Trung bình mỗi lần"
              value={money(avg)}
              valueClassName="text-lg md:text-xl"
              hint={`${list.length} lần mua`}
            />
          </div>

          <section className="panel overflow-hidden">
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
                {groups.map(([date, items]) => (
                  <div key={date}>
                    <div className="bg-surface-raised/60 px-5 py-1.5 text-xs font-medium capitalize text-muted-foreground">
                      {formatDate(date, "long")}
                    </div>
                    <ul className="divide-y divide-border">
                      {items.map((t) => (
                        <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                          <CoinLogo symbol={t.symbol} size={32} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="num font-semibold">
                                +{formatNumber(t.quantity)} {displaySymbol(t.symbol)}
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
                            <div className="num truncate text-xs text-muted-foreground">
                              Giá {money(t.price_usd)} · Tổng{" "}
                              {money(t.quantity * t.price_usd + t.fee_usd)}
                              {t.note ? ` · ${t.note}` : ""}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Sửa giao dịch"
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
                            className="text-muted-foreground hover:text-loss"
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
            )}
          </section>
        </div>
      </div>

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
                `${formatNumber(toDelete.quantity)} ${displaySymbol(toDelete.symbol)} ngày ${formatDate(toDelete.tx_date)}. `}
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

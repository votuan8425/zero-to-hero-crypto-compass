import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BookMarked, GitCompareArrows, Info, Plus, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { CoinLogo } from "@/components/app/coin-logo";
import { DonutChart, CHART_COLORS } from "@/components/app/donut-chart";
import { PnlText } from "@/components/app/stat";
import { usePortfolio, useReferences } from "@/hooks/use-app-data";
import { useUser } from "@/hooks/use-user";
import { displaySymbol } from "@/lib/coins";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { earliestTxDate, formatDurationSince } from "@/lib/accumulation";
import { isAdminUser } from "@/lib/admin";
import {
  adminAllocationKey,
  fetchAdminAllocation,
  syncAdminAllocation,
  type AdminAllocation,
} from "@/lib/admin-allocation";

export const Route = createFileRoute("/_authenticated/tham-khao/")({
  head: () => ({
    meta: [
      { title: "Tham khảo — ZERO TO HERO" },
      {
        name: "description",
        content: "Danh mục tham khảo của Admin — chỉ tỷ lệ %, không phải khuyến nghị đầu tư.",
      },
      { property: "og:title", content: "Tham khảo — ZERO TO HERO" },
      { property: "og:description", content: "Danh mục tham khảo của Admin, chỉ tỷ lệ %." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferencesPage,
});

/**
 * Portfolio đã đăng của Admin — chỉ % từng token, thời gian đã tích lũy và
 * lãi/lỗ % theo vốn. Không bao giờ hiển thị số tiền, số lượng hay ngày mua
 * cụ thể của admin.
 */
function AdminAllocationCard({
  allocation,
  preview,
}: {
  allocation: AdminAllocation;
  preview?: boolean;
}) {
  const pnl = allocation.pnlPct;
  return (
    <section className="panel hero-glow relative mb-5 overflow-hidden p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Danh mục của Admin</h2>
        <span className="text-xs text-muted-foreground">
          {preview ? "Xem trước — chưa đăng" : `Cập nhật: ${formatDateTime(allocation.updated_at)}`}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-raised px-2 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Đã tích lũy
          </div>
          <div className="num mt-1 text-base font-bold leading-tight md:text-lg">
            {allocation.startedAt ? formatDurationSince(allocation.startedAt) : "—"}
          </div>
        </div>
        <div className="rounded-xl bg-surface-raised px-2 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Lãi / Lỗ theo vốn
          </div>
          <PnlText value={pnl} className="num mt-1 block text-base font-bold leading-tight md:text-lg">
            {pnl != null ? `${pnl >= 0 ? "+" : ""}${formatNumber(pnl, 1)}%` : "—"}
          </PnlText>
        </div>
        <div className="rounded-xl bg-surface-raised px-2 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Số loại token
          </div>
          <div className="num mt-1 text-base font-bold leading-tight md:text-lg">
            {allocation.slices.length}
          </div>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Chỉ tỷ lệ % vốn nắm giữ từng token — không phải khuyến nghị đầu tư.
      </p>
      <DonutChart
        items={allocation.slices}
        centerLabel="token"
        centerValue={String(allocation.slices.length)}
      />
      <ul className="mt-4 space-y-1.5">
        {allocation.slices.map((s) => (
          <li key={s.symbol} className="flex items-center gap-2 text-sm">
            <CoinLogo symbol={s.symbol} size={18} />
            <span className="flex-1">{displaySymbol(s.symbol)}</span>
            <span className="num text-muted-foreground">{formatPercent(s.percent)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReferencesPage() {
  const user = useUser();
  const qc = useQueryClient();
  const admin = isAdminUser(user);
  const refs = useReferences();
  const list = refs.data ?? [];
  const { allocation, totals, txs, prices } = usePortfolio();
  const adminAllocation = useQuery({
    queryKey: adminAllocationKey,
    queryFn: fetchAdminAllocation,
    staleTime: 60_000,
  });
  const syncedRef = useRef(false);
  const [deploying, setDeploying] = useState(false);

  // Số liệu công khai khi đăng: ngày mua đầu tiên + lãi/lỗ % theo vốn.
  const adminStats = {
    startedAt: earliestTxDate(txs.data ?? []),
    pnlPct: totals.pnlPct,
  };
  // Xem trước nội dung sẽ đăng (tính từ danh mục hiện tại của admin).
  const preview: AdminAllocation | null =
    admin && allocation.slices.length > 0
      ? {
          user_id: user.id,
          slices: allocation.slices.map((s) => ({
            symbol: s.symbol,
            name: s.name,
            percent: Math.round(s.percent * 100) / 100,
          })),
          updated_at: new Date().toISOString(),
          startedAt: adminStats.startedAt,
          pnlPct: adminStats.pnlPct,
        }
      : null;

  // Admin: đồng bộ tỷ lệ % danh mục của mình lên tab Tham khảo mỗi lần vào.
  useEffect(() => {
    if (!admin || syncedRef.current) return;
    if (txs.isLoading || prices.isLoading) return;
    if (allocation.slices.length === 0) return;
    syncedRef.current = true;
    void syncAdminAllocation(user, allocation, adminStats).catch((e) => {
      console.error("Không đồng bộ được danh mục admin", e);
      syncedRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, allocation, txs.isLoading, prices.isLoading, user]);

  async function deployPortfolio() {
    if (deploying) return;
    if (allocation.slices.length === 0) {
      toast.error("Bạn chưa có giao dịch nào để đăng.");
      return;
    }
    setDeploying(true);
    try {
      const res = await syncAdminAllocation(user, allocation, adminStats);
      await qc.invalidateQueries({ queryKey: adminAllocationKey });
      toast.success(
        res === "unchanged"
          ? "Portfolio của bạn đã đăng rồi, không có gì thay đổi."
          : "Đã đăng portfolio — người dùng khác sẽ thấy tỷ lệ % và hiệu suất của bạn.",
      );
    } catch {
      toast.error("Không đăng được portfolio. Vui lòng thử lại.");
    } finally {
      setDeploying(false);
    }
  }

  const published = adminAllocation.data ?? null;
  const card = published ?? preview;

  return (
    <div>
      <PageHeader
        title="Tham khảo"
        subtitle={
          admin
            ? "Chỉ bạn (admin) mới thêm/sửa được. Bấm “Đăng portfolio” để công bố danh mục của bạn cho mọi người dùng."
            : "Danh mục tham khảo của Admin — chỉ xem tỷ lệ %, không phải khuyến nghị đầu tư."
        }
        action={
          admin ? (
            <div className="flex flex-wrap gap-2">
              {list.length >= 1 && (
                <Button asChild variant="surface">
                  <Link to="/tham-khao/so-sanh">
                    <GitCompareArrows /> So sánh
                  </Link>
                </Button>
              )}
              <Button asChild variant="surface">
                <Link to="/tham-khao/moi">
                  <Plus /> Thêm danh mục
                </Link>
              </Button>
              <Button variant="hero" onClick={() => void deployPortfolio()} disabled={deploying}>
                <Rocket /> {deploying ? "Đang đăng…" : "Đăng portfolio"}
              </Button>
            </div>
          ) : undefined
        }
      />
      <div className="mb-4 flex gap-2 rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0" />
        {admin
          ? published
            ? `Portfolio của bạn đã đăng lúc ${formatDateTime(published.updated_at)} — người dùng khác chỉ thấy tỷ lệ % từng token, thời gian đã tích lũy và lãi/lỗ % theo vốn. Bấm “Đăng portfolio” để cập nhật lại bất cứ lúc nào.`
            : "Bạn chưa đăng portfolio. Bấm “Đăng portfolio” để công bố tỷ lệ % từng token, thời gian đã tích lũy và lãi/lỗ % theo vốn — không hiển thị số tiền hay số lượng."
          : "Chỉ admin mới được thêm/sửa danh mục tham khảo. Bạn chỉ xem tỷ lệ % danh mục của admin — không thấy số tiền, số lượng hay ghi chú của admin."}
      </div>

      {adminAllocation.isLoading ? (
        <Skeleton className="mb-5 h-56" />
      ) : card && card.slices.length > 0 ? (
        <AdminAllocationCard allocation={card} preview={!published} />
      ) : (
        <div className="panel mb-5 p-5 text-sm text-muted-foreground">
          Admin chưa công bố danh mục tham khảo.
        </div>
      )}

      {!admin ? null : refs.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<BookMarked className="h-6 w-6" />}
          title="Chưa có danh mục tham khảo"
          description="Tải ảnh chụp danh mục của một nhà đầu tư, AI sẽ trích xuất các coin và tỷ lệ phân bổ cho bạn."
          action={
            <Button asChild variant="hero">
              <Link to="/tham-khao/moi">
                <Plus /> Tải ảnh danh mục
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r, idx) => {
            const sorted = [...r.holdings]
              .filter((h) => h.percent != null)
              .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
            return (
              <Link
                key={r.id}
                to="/tham-khao/$id"
                params={{ id: r.id }}
                className="panel group block p-5 transition-colors hover:border-primary/50"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tham khảo {String(list.length - idx).padStart(2, "0")}
                </div>
                <h3 className="mt-1 truncate text-lg font-semibold group-hover:text-primary">
                  {r.name}
                </h3>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(r.created_at)} · {r.holdings.length} coin
                </div>
                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface-raised">
                  {sorted.map((h, i) => (
                    <div
                      key={h.symbol}
                      style={{
                        width: `${h.percent}%`,
                        background: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                  ))}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {sorted.slice(0, 4).map((h) => (
                    <li key={h.symbol} className="flex items-center gap-2 text-sm">
                      <CoinLogo symbol={h.symbol} size={18} />
                      <span className="flex-1">{displaySymbol(h.symbol)}</span>
                      <span className="num text-muted-foreground">{formatPercent(h.percent)}</span>
                    </li>
                  ))}
                </ul>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

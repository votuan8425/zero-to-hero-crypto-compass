import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BookMarked, GitCompareArrows, Info, MessageSquareQuote, Pencil, Plus, Quote, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  fetchPublishedAllocations,
  publishedAllocationsKey,
  readFollowedInvestorId,
  saveFollowedInvestorId,
  selectPublishedAllocation,
  syncAdminAllocation,
  type AdminAllocation,
} from "@/lib/admin-allocation";
import { cn } from "@/lib/utils";

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
  isAdmin,
  onEditMessage,
}: {
  allocation: AdminAllocation;
  preview?: boolean;
  isAdmin?: boolean;
  onEditMessage?: () => void;
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
      {allocation.message ? (
        <figure className="relative mt-5 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-surface to-surface p-5">
          <Quote
            className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 text-primary/10"
            aria-hidden
          />
          <figcaption className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <MessageSquareQuote className="h-4 w-4" /> Lời nhắn của nhà đầu tư
          </figcaption>
          <blockquote className="mt-3 whitespace-pre-wrap text-[15px] font-medium leading-relaxed">
            {allocation.message}
          </blockquote>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="lime-gradient grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-black text-primary-foreground">
              A
            </span>
            <span className="font-medium text-foreground">Admin</span>
            {allocation.messageUpdatedAt && (
              <>
                <span aria-hidden>·</span>
                <span>Cập nhật {formatDateTime(allocation.messageUpdatedAt)}</span>
              </>
            )}
            {isAdmin && onEditMessage && (
              <button
                type="button"
                onClick={onEditMessage}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <Pencil className="h-3.5 w-3.5" /> Sửa
              </button>
            )}
          </div>
        </figure>
      ) : (
        isAdmin &&
        onEditMessage && (
          <button
            type="button"
            onClick={onEditMessage}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <MessageSquareQuote className="h-4 w-4" /> Thêm lời nhắn của nhà đầu tư
          </button>
        )
      )}
    </section>
  );
}

const MESSAGE_MAX = 500;

/**
 * Thẻ xem trước một nhà đầu tư đã đăng — hiện luôn cho mọi người xem,
 * KHÔNG cần bấm theo dõi trước. Bấm vào thẻ để xem danh mục đầy đủ
 * (biểu đồ tròn, thống kê, lời nhắn) ở phía dưới. Nút "Theo dõi" chỉ để
 * ghim nhà đầu tư yêu thích, không phải điều kiện để xem.
 */
function InvestorCard({
  allocation,
  isSelected,
  isFollowed,
  onSelect,
  onFollow,
}: {
  allocation: AdminAllocation;
  isSelected: boolean;
  isFollowed: boolean;
  onSelect: () => void;
  onFollow: () => void;
}) {
  const top = [...allocation.slices]
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3);
  return (
    <article
      onClick={onSelect}
      className={cn(
        "panel group cursor-pointer p-4 transition-colors hover:border-primary/50",
        isSelected && "border-primary/60 ring-1 ring-primary/40",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="lime-gradient grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-black text-primary-foreground">
          A
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">Admin</span>
          <span className="block text-xs text-muted-foreground">
            Cập nhật {formatDateTime(allocation.updated_at)}
          </span>
        </span>
        {allocation.pnlPct != null && (
          <PnlText value={allocation.pnlPct} className="num shrink-0 text-sm font-semibold">
            {allocation.pnlPct >= 0 ? "+" : ""}
            {formatNumber(allocation.pnlPct, 1)}%
          </PnlText>
        )}
      </div>
      <div className="mt-3">
        <DonutChart items={allocation.slices} showLegend={false} height={120} />
      </div>
      <ul className="mt-3 space-y-1.5">
        {top.map((s) => (
          <li key={s.symbol} className="flex items-center gap-2 text-sm">
            <CoinLogo symbol={s.symbol} size={18} />
            <span className="flex-1">{displaySymbol(s.symbol)}</span>
            <span className="num text-muted-foreground">{formatPercent(s.percent)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          {allocation.slices.length} token
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFollow();
          }}
          aria-pressed={isFollowed}
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            isFollowed
              ? "bg-primary text-primary-foreground"
              : "bg-surface-raised text-muted-foreground hover:text-foreground",
          )}
        >
          {isFollowed ? "Đang theo dõi" : "Theo dõi"}
        </button>
      </div>
    </article>
  );
}

/** Dialog để admin viết/sửa lời nhắn của nhà đầu tư (để trống để gỡ). */
function AdminMessageDialog({
  open,
  onOpenChange,
  initial,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: string;
  saving: boolean;
  onSave: (message: string) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lời nhắn của nhà đầu tư</DialogTitle>
          <DialogDescription>
            Lời nhắn hiển thị cùng danh mục đã đăng trên tab Tham khảo cho mọi người dùng. Lưu
            lời nhắn cũng đăng lại danh mục hiện tại của bạn.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MESSAGE_MAX))}
          rows={5}
          placeholder="Ví dụ: Tích sản đều đặn, đừng để cảm xúc quyết định. Tháng này mình vẫn giữ nguyên tỷ lệ ETH và BTC."
          className="resize-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {value.trim() ? `${value.trim().length}/${MESSAGE_MAX} ký tự` : "Để trống để gỡ lời nhắn"}
          </span>
          <span>Chỉ text — không hiển thị số tiền hay số lượng.</span>
        </div>
        <DialogFooter>
          <Button variant="surface" onClick={() => onOpenChange(false)} disabled={saving}>
            Hủy
          </Button>
          <Button variant="hero" onClick={() => onSave(value)} disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu lời nhắn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReferencesPage() {
  const user = useUser();
  const qc = useQueryClient();
  const admin = isAdminUser(user);
  const refs = useReferences();
  const list = refs.data ?? [];
  const { allocation, totals, txs, prices } = usePortfolio();
  const publishedQuery = useQuery({
    queryKey: publishedAllocationsKey,
    queryFn: fetchPublishedAllocations,
    staleTime: 60_000,
  });
  const investors = publishedQuery.data ?? [];
  // Nhà đầu tư đang theo dõi (lưu trên thiết bị) — bấm một nhà đầu tư trong
  // danh sách là theo dõi + xem danh mục của họ; lần sau mở lại vẫn thấy họ.
  const [followedId, setFollowedId] = useState<string | null>(() =>
    readFollowedInvestorId(),
  );
  const selected = selectPublishedAllocation(investors, followedId);

  function followInvestor(userId: string) {
    setFollowedId(userId);
    saveFollowedInvestorId(userId);
  }
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
          // Chưa đăng nên chưa có lời nhắn (lưu lời nhắn sẽ đăng kèm danh mục).
          message: null,
          messageUpdatedAt: null,
        }
      : null;

  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);

  // Lưu lời nhắn của nhà đầu tư kèm danh mục hiện tại (đăng lại portfolio).
  async function saveMessage(message: string) {
    if (savingMessage) return;
    setSavingMessage(true);
    try {
      const res = await syncAdminAllocation(user, allocation, adminStats, message);
      if (res === "skipped") {
        toast.error("Bạn chưa có giao dịch nào để đăng kèm lời nhắn.");
        return;
      }
      await qc.invalidateQueries({ queryKey: publishedAllocationsKey });
      setMessageDialogOpen(false);
      toast.success(message.trim() ? "Đã lưu lời nhắn của nhà đầu tư." : "Đã gỡ lời nhắn.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được lời nhắn. Vui lòng thử lại.");
    } finally {
      setSavingMessage(false);
    }
  }

  // Admin: đồng bộ tỷ lệ % danh mục của mình lên tab Tham khảo mỗi lần vào.
  useEffect(() => {
    if (!admin || syncedRef.current) return;
    if (txs.isLoading || prices.isLoading) return;
    if (allocation.slices.length === 0) return;
    syncedRef.current = true;
    void syncAdminAllocation(user, allocation, adminStats)
      .then(() => {
        void qc.invalidateQueries({ queryKey: publishedAllocationsKey });
      })
      .catch((e) => {
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
      await qc.invalidateQueries({ queryKey: publishedAllocationsKey });
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

  const card = selected ?? preview;
  // Xem trước khi admin chưa đăng (không có trong danh sách đã đăng).
  const isPreview = !selected && !!preview;
  // Chỉ admin mới sửa được lời nhắn — và chỉ trên chính danh mục của mình.
  const isOwnCard = admin && card?.user_id === user.id;
  // Danh mục đã đăng của chính admin (để hiện "đã đăng lúc ..." trong banner).
  const ownPublished = admin ? (investors.find((a) => a.user_id === user.id) ?? null) : null;

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
          ? ownPublished
            ? `Portfolio của bạn đã đăng lúc ${formatDateTime(ownPublished.updated_at)} — người dùng khác chỉ thấy tỷ lệ % từng token, thời gian đã tích lũy và lãi/lỗ % theo vốn. Bấm “Đăng portfolio” để cập nhật lại bất cứ lúc nào.`
            : "Bạn chưa đăng portfolio. Bấm “Đăng portfolio” để công bố tỷ lệ % từng token, thời gian đã tích lũy và lãi/lỗ % theo vốn — không hiển thị số tiền hay số lượng."
          : "Chỉ admin mới được thêm/sửa danh mục tham khảo. Bạn chỉ xem tỷ lệ % danh mục của admin — không thấy số tiền, số lượng hay ghi chú của admin."}
      </div>

      {/* Danh sách nhà đầu tư đã đăng — hiện tất cả dưới dạng lưới thẻ, mỗi
          thẻ là một bản xem trước danh mục (biểu đồ tròn + top token + lãi/lỗ).
          Xem được ngay, không cần theo dõi trước; bấm một thẻ để xem danh mục
          đầy đủ của nhà đầu tư đó ở phía dưới. Nút "Theo dõi" chỉ để ghim. */}
      {investors.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider">
            Nhà đầu tư · {investors.length}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {investors.map((inv) => (
              <InvestorCard
                key={inv.user_id}
                allocation={inv}
                isSelected={selected?.user_id === inv.user_id}
                isFollowed={followedId === inv.user_id}
                onSelect={() => followInvestor(inv.user_id)}
                onFollow={() => followInvestor(inv.user_id)}
              />
            ))}
          </div>
        </section>
      )}

      {publishedQuery.isLoading ? (
        <Skeleton className="mb-5 h-56" />
      ) : card && card.slices.length > 0 ? (
        <AdminAllocationCard
          allocation={card}
          preview={isPreview}
          isAdmin={isOwnCard}
          onEditMessage={isOwnCard ? () => setMessageDialogOpen(true) : undefined}
        />
      ) : (
        <div className="panel mb-5 p-5 text-sm text-muted-foreground">
          Admin chưa công bố danh mục tham khảo.
        </div>
      )}

      <AdminMessageDialog
        open={messageDialogOpen}
        onOpenChange={setMessageDialogOpen}
        initial={card?.message ?? ""}
        saving={savingMessage}
        onSave={(message) => void saveMessage(message)}
      />

      {/* Danh mục tham khảo từ ảnh chụp (tính năng riêng của admin: tải ảnh
          chụp danh mục của một nhà đầu tư, AI trích xuất coin + tỷ lệ) —
          KHÁC với danh mục đã đăng ở trên. Tiêu đề rõ ràng để không nhầm
          với "chưa có danh mục nào" khi danh mục đã đăng vẫn đang hiện. */}
      {!admin ? null : (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider">
            Danh mục tham khảo từ ảnh chụp
          </h2>
          {refs.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={<BookMarked className="h-6 w-6" />}
              title="Chưa có ảnh danh mục tham khảo"
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
        </section>
      )}
    </div>
  );
}

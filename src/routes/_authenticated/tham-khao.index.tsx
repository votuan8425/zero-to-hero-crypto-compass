import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookMarked, Check, GitCompareArrows, Info, Lock, MessageSquareQuote, Pencil, Plus, Quote, Rocket, Send, UserCheck, UserX, X } from "lucide-react";
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
import { PushOptInCard, usePushSoftAsk } from "@/components/app/push-opt-in-card";
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
  syncAdminAllocation,
  type AdminAllocation,
} from "@/lib/admin-allocation";
import {
  cancelFollow,
  fetchMyFollowMap,
  fetchPendingFollowRequests,
  requestFollow,
  reviewFollowRequest,
  type FollowStatus,
  type InvestorFollow,
} from "@/lib/investor-follow";

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
 * MỘT thẻ duy nhất cho một nhà đầu tư đã đăng — gộp cả xem trước và danh
 * mục đầy đủ vào cùng một thẻ, không còn 2 thẻ trùng nhau (thẻ mini + thẻ
 * chi tiết) như trước.
 *
 * Chart (thống kê + biểu đồ tròn + tỷ lệ từng token + lời nhắn) CHỈ hiện khi
 * người xem là chính admin đó hoặc đã được admin duyệt theo dõi. Chưa được
 * duyệt thì chỉ thấy tên + cập nhật lúc nào, và nút gửi yêu cầu theo dõi.
 * Không bao giờ hiển thị số tiền, số lượng hay ngày mua cụ thể của admin.
 */
function InvestorPortfolioCard({
  allocation,
  preview,
  isOwn,
  followStatus,
  isAdmin,
  onEditMessage,
  onRequestFollow,
  onCancelFollow,
  busy,
}: {
  allocation: AdminAllocation;
  preview?: boolean;
  isOwn?: boolean;
  followStatus?: FollowStatus | null;
  isAdmin?: boolean;
  onEditMessage?: () => void;
  onRequestFollow?: () => void;
  onCancelFollow?: () => void;
  busy?: boolean;
}) {
  const pnl = allocation.pnlPct;
  // Chính admin hoặc đã được duyệt mới được xem chart.
  const canView = !!isOwn || followStatus === "approved";
  return (
    <section className="panel hero-glow relative overflow-hidden p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="lime-gradient grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-black text-primary-foreground">
            A
          </span>
          <div>
            <h2 className="text-lg font-semibold leading-tight">Danh mục của Admin</h2>
            <span className="text-xs text-muted-foreground">
              {preview
                ? "Xem trước — chưa đăng"
                : `Cập nhật: ${formatDateTime(allocation.updated_at)}`}
            </span>
          </div>
        </div>
        {canView && pnl != null && (
          <PnlText value={pnl} className="num shrink-0 text-base font-bold">
            {pnl >= 0 ? "+" : ""}
            {formatNumber(pnl, 1)}%
          </PnlText>
        )}
      </div>

      {canView ? (
        <>
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
          {followStatus === "approved" && onCancelFollow && (
            <button
              type="button"
              onClick={onCancelFollow}
              disabled={busy}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <UserX className="h-3.5 w-3.5" /> Ngừng theo dõi
            </button>
          )}
          {/* Admin cũng theo dõi được chính mình (để test luồng duyệt): khi
              chưa gửi yêu cầu thì hiện nút Theo dõi, đang chờ thì hiện trạng
              thái chờ duyệt. Người thường thì nút này nằm ở trạng thái khóa. */}
          {isOwn && followStatus !== "approved" && (
            <div className="mt-4">
              {followStatus === "pending" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                    <Send className="h-3.5 w-3.5" /> Đang chờ duyệt
                  </span>
                  {onCancelFollow && (
                    <button
                      type="button"
                      onClick={onCancelFollow}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" /> Hủy yêu cầu
                    </button>
                  )}
                </div>
              ) : (
                onRequestFollow && (
                  <Button variant="surface" size="sm" onClick={onRequestFollow} disabled={busy}>
                    <Send /> {busy ? "Đang gửi…" : "Theo dõi"}
                  </Button>
                )
              )}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-5 text-center">
          <Lock className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">
            Biểu đồ danh mục chỉ hiện sau khi admin duyệt theo dõi.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Gửi yêu cầu theo dõi — admin duyệt thì bạn mới xem được tỷ lệ % từng token.
          </p>
          {followStatus === "pending" ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                <Send className="h-3.5 w-3.5" /> Đang chờ admin duyệt
              </span>
              {onCancelFollow && (
                <button
                  type="button"
                  onClick={onCancelFollow}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" /> Hủy yêu cầu
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4">
              {followStatus === "rejected" && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Yêu cầu trước đã bị từ chối — bạn có thể gửi lại.
                </p>
              )}
              {onRequestFollow && (
                <Button variant="hero" onClick={onRequestFollow} disabled={busy}>
                  <Send /> {busy ? "Đang gửi…" : "Gửi yêu cầu theo dõi"}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const MESSAGE_MAX = 500;

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
  // Trạng thái theo dõi của mình đối với từng nhà đầu tư (map investor_id ->
  // 'pending' | 'approved' | 'rejected'; không có key = chưa gửi yêu cầu).
  // Chart chỉ hiện khi đã được duyệt (hoặc là chính admin đó).
  const followQuery = useQuery({
    queryKey: ["my-investor-follows"],
    queryFn: fetchMyFollowMap,
    staleTime: 30_000,
  });
  const followMap = followQuery.data ?? {};
  const [followBusy, setFollowBusy] = useState<string | null>(null);
  const pushAsk = usePushSoftAsk();

  async function sendFollowRequest(investorId: string) {
    if (followBusy) return;
    setFollowBusy(investorId);
    try {
      await requestFollow(investorId);
      await qc.invalidateQueries({ queryKey: ["my-investor-follows"] });
      toast.success("Đã gửi yêu cầu theo dõi — chờ admin duyệt.");
      // Đúng lúc hỏi mềm bật thông báo đẩy: user vừa follow xong nên có lý do.
      pushAsk.maybeShow();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không gửi được yêu cầu. Vui lòng thử lại.");
    } finally {
      setFollowBusy(null);
    }
  }

  async function cancelFollowRequest(investorId: string) {
    if (followBusy) return;
    setFollowBusy(investorId);
    try {
      await cancelFollow(investorId);
      await qc.invalidateQueries({ queryKey: ["my-investor-follows"] });
      toast.success("Đã hủy yêu cầu / ngừng theo dõi.");
    } catch {
      toast.error("Không hủy được. Vui lòng thử lại.");
    } finally {
      setFollowBusy(null);
    }
  }

  // Admin: yêu cầu theo dõi đang chờ mình duyệt.
  const pendingQuery = useQuery({
    queryKey: ["pending-follow-requests", user.id],
    queryFn: () => fetchPendingFollowRequests(user.id),
    enabled: admin,
    staleTime: 30_000,
  });
  const pendingRequests = pendingQuery.data ?? [];
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);

  async function reviewRequest(req: InvestorFollow, decision: "approved" | "rejected") {
    if (reviewBusy) return;
    setReviewBusy(req.id);
    try {
      await reviewFollowRequest(req.id, decision);
      await qc.invalidateQueries({ queryKey: ["pending-follow-requests", user.id] });
      toast.success(
        decision === "approved"
          ? `Đã duyệt ${req.follower_name ?? "người dùng"} — họ xem được danh mục của bạn.`
          : `Đã từ chối yêu cầu của ${req.follower_name ?? "người dùng"}.`,
      );
    } catch {
      toast.error("Không xử lý được yêu cầu. Vui lòng thử lại.");
    } finally {
      setReviewBusy(null);
    }
  }

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
            pnlPct:
              s.pnlPct != null && Number.isFinite(s.pnlPct)
                ? Math.round(s.pnlPct * 100) / 100
                : null,
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

  // Admin CHỈ cập nhật portfolio khi bấm nút "Cập nhật portfolio" (updatePortfolio
  // bên dưới). Trước đây có một useEffect tự đồng bộ mỗi lần admin vào tab
  // Tham khảo — đã gỡ vì nó tự ghi đè hàng đã đăng (giá live làm tỷ lệ %
  // và lãi/lỗ trôi qua ngưỡng 0,01) rồi trigger báo cho mọi follower, dù
  // admin chỉ mở app xem chứ không đăng gì.
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
          : "Đã cập nhật portfolio — người dùng khác sẽ thấy tỷ lệ % và hiệu suất mới của bạn.",
      );
    } catch {
      toast.error("Không cập nhật được portfolio. Vui lòng thử lại.");
    } finally {
      setDeploying(false);
    }
  }

  // Xem trước khi admin chưa đăng (không có trong danh sách đã đăng).
  const previewCard = !investors.some((a) => a.user_id === user.id) ? preview : null;
  // Danh mục đã đăng của chính admin (để hiện "đã đăng lúc ..." trong banner).
  const ownPublished = admin ? (investors.find((a) => a.user_id === user.id) ?? null) : null;

  return (
    <div>
      <PageHeader
        title="Tham khảo"
        subtitle={
          admin
            ? "Chỉ bạn (admin) mới thêm/sửa được. Bấm “Cập nhật portfolio” để công bố hoặc cập nhật danh mục của bạn; người khác phải gửi yêu cầu theo dõi và được bạn duyệt mới xem được biểu đồ."
            : "Danh mục tham khảo của Admin — gửi yêu cầu theo dõi, admin duyệt thì mới xem được biểu đồ tỷ lệ %."
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
                <Rocket /> {deploying ? "Đang cập nhật…" : "Cập nhật portfolio"}
              </Button>
            </div>
          ) : undefined
        }
      />
      <div className="mb-4 flex gap-2 rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0" />
        {admin
          ? ownPublished
            ? `Portfolio của bạn đã đăng lúc ${formatDateTime(ownPublished.updated_at)} — chỉ người được bạn duyệt theo dõi mới xem được biểu đồ tỷ lệ %; người khác chỉ thấy tên và phải gửi yêu cầu. Bấm “Cập nhật portfolio” để cập nhật lại bất cứ lúc nào.`
            : "Bạn chưa đăng portfolio. Bấm “Cập nhật portfolio” để công bố danh mục — người khác phải gửi yêu cầu theo dõi và được bạn duyệt mới xem được biểu đồ."
          : "Biểu đồ danh mục chỉ hiện sau khi admin duyệt yêu cầu theo dõi của bạn. Gửi yêu cầu trên thẻ nhà đầu tư rồi chờ duyệt."}
      </div>

      {pushAsk.visible && <PushOptInCard onClose={() => pushAsk.setVisible(false)} />}

      {/* Mỗi nhà đầu tư MỘT thẻ duy nhất (đã gộp xem trước + danh mục đầy đủ).
          Chart chỉ hiện khi là chính admin đó hoặc đã được duyệt theo dõi. */}
      {publishedQuery.isLoading || followQuery.isLoading ? (
        <Skeleton className="mb-5 h-56" />
      ) : investors.length === 0 && !previewCard ? (
        <div className="panel mb-5 p-5 text-sm text-muted-foreground">
          Admin chưa công bố danh mục tham khảo.
        </div>
      ) : (
        <div className="mb-5 grid gap-4 lg:grid-cols-2">
          {investors.map((inv) => {
            const isOwn = admin && inv.user_id === user.id;
            return (
              <InvestorPortfolioCard
                key={inv.user_id}
                allocation={inv}
                isOwn={isOwn}
                followStatus={followMap[inv.user_id] ?? null}
                isAdmin={isOwn}
                {...(isOwn ? { onEditMessage: () => setMessageDialogOpen(true) } : {})}
                onRequestFollow={() => void sendFollowRequest(inv.user_id)}
                onCancelFollow={() => void cancelFollowRequest(inv.user_id)}
                busy={followBusy === inv.user_id}
              />
            );
          })}
          {previewCard && (
            <InvestorPortfolioCard
              allocation={previewCard}
              preview
              isOwn
              followStatus="approved"
              isAdmin
              onEditMessage={() => setMessageDialogOpen(true)}
            />
          )}
        </div>
      )}

      <AdminMessageDialog
        open={messageDialogOpen}
        onOpenChange={setMessageDialogOpen}
        initial={
          (investors.find((a) => a.user_id === user.id) ?? previewCard)?.message ?? ""
        }
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

      {/* Bảng danh sách chờ duyệt theo dõi — dành cho admin, nằm ở CUỐI
          trang Tham khảo. Duyệt thì người đó xem được biểu đồ danh mục của
          bạn; từ chối thì họ có thể gửi lại sau. */}
      {admin && pendingRequests.length > 0 && (
        <section className="panel mt-6 border-primary/40 p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <UserCheck className="h-4 w-4 text-primary" />
            Yêu cầu theo dõi đang chờ duyệt · {pendingRequests.length}
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Duyệt thì người đó xem được biểu đồ danh mục của bạn; từ chối thì họ có thể gửi lại sau.
          </p>
          <ul className="space-y-2">
            {pendingRequests.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <span className="lime-gradient grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-black text-primary-foreground">
                  {(req.follower_name ?? "?").trim().charAt(0).toUpperCase() || "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {req.follower_name ?? "Người dùng"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Gửi lúc {formatDateTime(req.created_at)}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <Button
                    variant="hero"
                    size="sm"
                    disabled={reviewBusy === req.id}
                    onClick={() => void reviewRequest(req, "approved")}
                  >
                    <Check /> Duyệt
                  </Button>
                  <Button
                    variant="surface"
                    size="sm"
                    disabled={reviewBusy === req.id}
                    onClick={() => void reviewRequest(req, "rejected")}
                  >
                    <X /> Từ chối
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

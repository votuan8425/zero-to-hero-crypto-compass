import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { CoinLogo } from "@/components/app/coin-logo";
import { PnlText, Stat } from "@/components/app/stat";
import { usePrices } from "@/hooks/use-app-data";
import { useUser } from "@/hooks/use-user";
import { ADMIN_EMAIL, isAdminUser } from "@/lib/admin";
import {
  adminDeleteUser,
  adminUpdateUser,
  adminUsersKey,
  adminUsersQuery,
  computeAdminUserStats,
  type AdminUserRow,
} from "@/lib/admin-dashboard";
import {
  CURRENCY_OPTIONS,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPercent,
  type Currency,
} from "@/lib/format";

export const Route = createFileRoute("/_authenticated/quan-tri")({
  head: () => ({
    meta: [
      { title: "Quản trị — ZERO TO HERO" },
      {
        name: "description",
        content: "Dashboard quản trị: xem vốn và tỷ lệ nắm giữ của mọi tài khoản, sửa và xóa tài khoản. Chỉ admin.",
      },
      { property: "og:title", content: "Quản trị — ZERO TO HERO" },
      {
        property: "og:description",
        content: "Dashboard quản trị của Admin — chỉ admin xem được.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: ({ context }) => {
    if (!isAdminUser(context.user)) throw redirect({ to: "/trang-chu" });
  },
  component: AdminDashboardPage,
});

function displayNameOf(u: AdminUserRow): string {
  return (
    u.display_name?.trim() ||
    u.username?.trim() ||
    (u.email ? u.email.split("@")[0] : "") ||
    "Người dùng"
  );
}

function AdminDashboardPage() {
  const user = useUser();
  const qc = useQueryClient();
  const usersQ = useQuery(adminUsersQuery);
  const prices = usePrices();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null);
  const [busy, setBusy] = useState(false);

  const users = usersQ.data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [displayNameOf(u), u.email ?? "", u.username ?? ""].some((s) =>
        s.toLowerCase().includes(q),
      ),
    );
  }, [users, query]);

  const totals = useMemo(() => {
    const pm = prices.data?.prices ?? {};
    const usdVnd = prices.data?.usdVnd ?? null;
    let invested = 0;
    let value: number | null = 0;
    for (const u of users) {
      const s = computeAdminUserStats(u.holdings, pm, usdVnd);
      invested += s.investedUsd;
      value = value == null || s.valueUsd == null ? null : value + s.valueUsd;
    }
    return { invested, value, count: users.length };
  }, [users, prices.data]);

  const refresh = () => qc.invalidateQueries({ queryKey: adminUsersKey });

  if (usersQ.isError) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Quản trị"
          subtitle="Chỉ admin xem được — quản lý mọi tài khoản."
        />
        <div className="panel space-y-2 p-5">
          <p className="font-semibold">Chưa tải được danh sách tài khoản.</p>
          <p className="text-sm text-muted-foreground">
            Khả năng cao là migration 0008 (bảng + hàm quản trị) chưa được chạy trên database —
            bấm Publish trong Lovable không tự chạy migration mới. Nhờ Lovable chạy migration
            0008_admin_dashboard.sql rồi tải lại trang này.
          </p>
          <Button variant="outline" onClick={() => usersQ.refetch()}>
            Thử tải lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quản trị"
        subtitle="Chỉ admin xem được — vốn, tỷ lệ nắm giữ, sửa và xóa tài khoản."
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Tài khoản"
          icon={<Users className="h-3.5 w-3.5" />}
          value={usersQ.isLoading ? "—" : String(totals.count)}
        />
        <Stat
          label="Tổng vốn"
          value={usersQ.isLoading ? "—" : formatMoney(totals.invested, "USDT")}
        />
        <Stat
          label="Tổng giá trị"
          value={usersQ.isLoading ? "—" : formatMoney(totals.value, "USDT")}
          hint={totals.value == null ? "Chưa đủ giá live để định giá hết" : undefined}
        />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên, email, tài khoản…"
          className="pl-9"
          aria-label="Tìm tài khoản"
        />
      </div>

      {usersQ.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={query ? "Không tìm thấy tài khoản nào" : "Chưa có tài khoản nào"}
          description={
            query ? "Thử từ khóa khác." : "Khi có người đăng ký, tài khoản của họ sẽ hiện ở đây."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <UserCard
              key={u.user_id}
              u={u}
              prices={prices.data?.prices ?? {}}
              usdVnd={prices.data?.usdVnd ?? null}
              isSelf={u.user_id === user.id}
              onEdit={() => setEditing(u)}
              onDelete={() => setDeleting(u)}
            />
          ))}
        </div>
      )}

      <EditUserDialog
        user={editing}
        busy={busy}
        onClose={() => setEditing(null)}
        onSave={async (displayName, currency) => {
          if (!editing) return;
          setBusy(true);
          try {
            await adminUpdateUser(editing.user_id, { display_name: displayName, currency });
            toast.success("Đã lưu thay đổi.");
            setEditing(null);
            await refresh();
          } catch {
            toast.error("Không lưu được. Vui lòng thử lại.");
          } finally {
            setBusy(false);
          }
        }}
      />

      <AlertDialog open={deleting != null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa tài khoản “{deleting ? displayNameOf(deleting) : ""}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Xóa hẳn tài khoản này: toàn bộ giao dịch, danh mục tham khảo, yêu cầu theo dõi,
              thông báo và tài khoản đăng nhập đều bị xóa và không khôi phục được. Hành động này
              không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!deleting) return;
                setBusy(true);
                try {
                  await adminDeleteUser(deleting.user_id);
                  toast.success("Đã xóa tài khoản.");
                  setDeleting(null);
                  await refresh();
                } catch {
                  toast.error("Không xóa được tài khoản. Vui lòng thử lại.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && <Loader2 className="animate-spin" />} Xóa hẳn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserCard({
  u,
  prices,
  usdVnd,
  isSelf,
  onEdit,
  onDelete,
}: {
  u: AdminUserRow;
  prices: Parameters<typeof computeAdminUserStats>[1];
  usdVnd: number | null;
  isSelf: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stats = computeAdminUserStats(u.holdings, prices, usdVnd);
  const isAdminRow = u.email?.toLowerCase() === ADMIN_EMAIL;
  const name = displayNameOf(u);
  return (
    <div className="panel space-y-3 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-raised text-base font-bold text-primary ring-1 ring-border">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{name}</span>
            {isAdminRow && (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3 w-3" /> Quản trị viên
              </Badge>
            )}
            {isSelf && <Badge variant="outline">Đây là bạn</Badge>}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {u.email ?? "—"}
            {u.username ? ` · @${u.username}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tham gia {u.created_at ? formatDate(u.created_at) : "—"} · Đăng nhập cuối{" "}
            {u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "chưa đăng nhập"} ·{" "}
            {u.tx_count} giao dịch · Tiền tệ: {u.currency}
          </p>
        </div>
        {!isSelf && (
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Sửa ${name}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              aria-label={`Xóa ${name}`}
              className="text-loss hover:text-loss"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-border/70 pt-3 text-sm">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Vốn
          </div>
          <div className="num mt-0.5 font-semibold">{formatMoney(stats.investedUsd, "USDT")}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Giá trị
          </div>
          <div className="num mt-0.5 font-semibold">{formatMoney(stats.valueUsd, "USDT")}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Lãi / lỗ
          </div>
          <PnlText value={stats.pnlUsd} className="mt-0.5 block font-semibold">
            {stats.pnlUsd == null
              ? "—"
              : `${formatMoney(stats.pnlUsd, "USDT")} (${formatPercent(stats.pnlPct, 2, true)})`}
          </PnlText>
        </div>
      </div>

      {stats.slices.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {stats.slices.slice(0, 4).map((s) => (
            <span
              key={s.symbol}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-2.5 py-1 text-xs font-semibold ring-1 ring-border"
            >
              <CoinLogo symbol={s.symbol} size={18} />
              {s.symbol} {formatPercent(s.percent, 1)}
            </span>
          ))}
          {stats.slices.length > 4 && (
            <span className="text-xs text-muted-foreground">
              +{stats.slices.length - 4} đồng khác
            </span>
          )}
          {stats.basis === "cost" && (
            <span className="text-xs text-muted-foreground">· % theo vốn (chưa đủ giá live)</span>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Chưa có giao dịch nào.</p>
      )}
    </div>
  );
}

function EditUserDialog({
  user,
  busy,
  onClose,
  onSave,
}: {
  user: AdminUserRow | null;
  busy: boolean;
  onClose: () => void;
  onSave: (displayName: string | null, currency: Currency) => Promise<void>;
}) {
  return (
    <Dialog open={user != null} onOpenChange={(open) => !open && onClose()}>
      {user && (
        <EditUserForm key={user.user_id} user={user} busy={busy} onClose={onClose} onSave={onSave} />
      )}
    </Dialog>
  );
}

function EditUserForm({
  user,
  busy,
  onClose,
  onSave,
}: {
  user: AdminUserRow;
  busy: boolean;
  onClose: () => void;
  onSave: (displayName: string | null, currency: Currency) => Promise<void>;
}) {
  const [name, setName] = useState(user.display_name ?? "");
  const [currency, setCurrency] = useState<Currency>(user.currency);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Sửa tài khoản</DialogTitle>
        <DialogDescription>
          {user.email ?? ""}
          {user.username ? ` · @${user.username}` : ""}
        </DialogDescription>
      </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="admin-edit-name">Tên hiển thị</Label>
            <Input
              id="admin-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên hiển thị"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Đơn vị tiền tệ hiển thị</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button
            variant="hero"
            disabled={busy}
            onClick={() => onSave(name.trim() || null, currency)}
          >
            {busy && <Loader2 className="animate-spin" />} Lưu
          </Button>
        </DialogFooter>
    </DialogContent>
  );
}

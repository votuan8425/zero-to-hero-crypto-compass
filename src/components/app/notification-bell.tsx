/**
 * Chuông thông báo ở đầu app: số chưa đọc + danh sách thông báo.
 * Thông báo mới tới lúc đang mở app thì hiện toast và cập nhật số ngay
 * qua Supabase Realtime (bảng `notifications`, chỉ dòng của mình).
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/integrations/supabase/client";
import {
  NOTIFICATIONS_QUERY_KEY,
  UNREAD_COUNT_QUERY_KEY,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Vừa xong";
  if (min < 60) return `${min} phút trước`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Hôm qua";
  if (d < 7) return `${d} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export function NotificationBell() {
  const user = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const countQuery = useQuery({
    queryKey: UNREAD_COUNT_QUERY_KEY,
    queryFn: fetchUnreadCount,
    staleTime: 30_000,
  });
  const listQuery = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => fetchNotifications(30),
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          void qc.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
          void qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
          const n = payload.new as { title?: unknown; body?: unknown };
          if (typeof n.title === "string") {
            toast.info(n.title, {
              description: typeof n.body === "string" ? n.body : undefined,
            });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  const unread = countQuery.data ?? 0;

  async function openNotification(n: AppNotification) {
    setOpen(false);
    if (!n.read_at) {
      try {
        await markNotificationRead(n.id);
      } catch {
        // Đọc sau cũng được — không chặn điều hướng.
      }
      void qc.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    }
    void navigate({ to: n.link || "/tham-khao" });
  }

  async function markAllRead() {
    try {
      await markAllNotificationsRead();
      void qc.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    } catch {
      toast.error("Không đánh dấu được. Vui lòng thử lại.");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Thông báo (${unread} chưa đọc)` : "Thông báo"}
          className="relative grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-surface-raised"
        >
          {unread > 0 ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5 text-muted-foreground" />
          )}
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Thông báo</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Đọc tất cả
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {listQuery.isPending ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Đang tải…
            </p>
          ) : (listQuery.data ?? []).length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Chưa có thông báo nào.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {(listQuery.data ?? []).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void openNotification(n)}
                    className={cn(
                      "block w-full px-4 py-3 text-left transition-colors hover:bg-surface-raised/60",
                      !n.read_at && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold leading-snug">{n.title}</span>
                      {!n.read_at && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {n.body}
                    </p>
                    <span className="mt-1 block text-[11px] text-muted-foreground/70">
                      {timeAgo(n.created_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

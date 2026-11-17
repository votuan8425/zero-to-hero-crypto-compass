import { CloudOff, Loader2, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSync } from "./sync-provider";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SyncBadge({ className }: { className?: string }) {
  const { online, pending, syncing, realtime, lastSyncedAt, syncNow } = useSync();
  const state = !online ? "offline" : syncing ? "syncing" : pending > 0 ? "pending" : "ok";
  const label = {
    offline: "Ngoại tuyến",
    syncing: "Đang đồng bộ",
    pending: `${pending} chờ đồng bộ`,
    ok: "Đã đồng bộ",
  }[state];
  const tip = !online
    ? "Mất kết nối. Giao dịch mới được lưu tạm trên thiết bị và sẽ tự đồng bộ khi có mạng."
    : `${realtime ? "Đồng bộ thời gian thực đang bật." : "Đang kết nối đồng bộ thời gian thực…"}${lastSyncedAt ? ` Lần cuối: ${formatDateTime(lastSyncedAt)}` : ""}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => void syncNow()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            state === "offline" && "border-warning/40 bg-warning/10 text-warning",
            state === "pending" && "border-info/40 bg-info/10 text-info",
            (state === "ok" || state === "syncing") &&
              "border-border bg-surface text-muted-foreground hover:text-foreground",
            className,
          )}
          aria-label={`Trạng thái đồng bộ: ${label}`}
        >
          {state === "offline" ? (
            <CloudOff className="h-3.5 w-3.5" />
          ) : state === "syncing" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : state === "pending" ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-gain animate-pulse-dot" />
          )}
          <span>{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{tip}</TooltipContent>
    </Tooltip>
  );
}

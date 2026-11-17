import { createFileRoute, Link } from "@tanstack/react-router";
import { BookMarked, GitCompareArrows, Info, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { CoinLogo } from "@/components/app/coin-logo";
import { CHART_COLORS } from "@/components/app/donut-chart";
import { useReferences } from "@/hooks/use-app-data";
import { displaySymbol } from "@/lib/coins";
import { formatDate, formatPercent } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tham-khao/")({
  head: () => ({
    meta: [
      { title: "Tham khảo — ZERO TO HERO" },
      {
        name: "description",
        content:
          "Lưu và phân tích danh mục tiền mã hoá của nhà đầu tư khác làm tài liệu tham khảo riêng.",
      },
      { property: "og:title", content: "Tham khảo — ZERO TO HERO" },
      { property: "og:description", content: "Danh mục tham khảo riêng tư, phân tích bằng AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferencesPage,
});

function ReferencesPage() {
  const refs = useReferences();
  const list = refs.data ?? [];
  return (
    <div>
      <PageHeader
        title="Tham khảo"
        subtitle="Danh mục của nhà đầu tư khác — tách biệt hoàn toàn với tài sản thật của bạn."
        action={
          <div className="flex gap-2">
            {list.length >= 1 && (
              <Button asChild variant="surface">
                <Link to="/tham-khao/so-sanh">
                  <GitCompareArrows /> So sánh
                </Link>
              </Button>
            )}
            <Button asChild variant="hero">
              <Link to="/tham-khao/moi">
                <Plus /> Thêm danh mục
              </Link>
            </Button>
          </div>
        }
      />
      <div className="mb-4 flex gap-2 rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0" />
        Chỉ mang tính tham khảo, không phải khuyến nghị đầu tư. Ảnh và dữ liệu chỉ bạn mới xem được.
      </div>
      {refs.isLoading ? (
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
                  {formatDate(r.created_at.slice(0, 10))} · {r.holdings.length} coin
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

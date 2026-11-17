import { Link } from "@tanstack/react-router";
import { BookMarked, CloudOff, Home, Layers, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "./brand";
import { SyncBadge } from "./sync-badge";
import { useSync } from "./sync-provider";

export const NAV_ITEMS = [
  { to: "/trang-chu", label: "TRANG CHỦ", icon: Home },
  { to: "/tich-san", label: "TÍCH SẢN", icon: Layers },
  { to: "/ca-nhan", label: "CÁ NHÂN", icon: UserRound },
  { to: "/tham-khao", label: "THAM KHẢO", icon: BookMarked },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { online } = useSync();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link to="/trang-chu" aria-label="ZERO TO HERO — Trang chủ">
            <BrandMark />
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Điều hướng chính">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "bg-surface-raised !text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <SyncBadge />
          </div>
        </div>
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-xs text-warning">
            <CloudOff className="h-3.5 w-3.5" /> Bạn đang ngoại tuyến — thay đổi sẽ được lưu tạm và
            tự đồng bộ khi có mạng.
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:pb-12 md:pt-8">{children}</main>

      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
        aria-label="Điều hướng chính"
      >
        <ul className="grid grid-cols-4">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="group flex flex-col items-center gap-1 pb-1 pt-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground"
                activeProps={{ className: "!text-primary" }}
              >
                <item.icon className="h-5 w-5" strokeWidth={2} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode;
}) {
  // Xếp DỌC trên điện thoại (tiêu đề full-width, nút xuống dưới): xếp NGANG
  // kiểu flex-row sẽ bóp tiêu đề/mô tả thành một cột hẹp khi cụm nút rộng
  // (tab Tham khảo có 3 nút) — mô tả bị ngắt từng chữ xuống dọc như ảnh lỗi.
  // Trên màn hình lớn (md+) mới xếp ngang.
  return (
    <div className="mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-surface-raised text-primary">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Stat({ label, value, hint, icon, className, valueClassName }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; className?: string; valueClassName?: string }) {
  return (
    <div className={cn("panel p-4", className)}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("num mt-2 text-xl font-semibold md:text-2xl", valueClassName)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function PnlText({ value, children, className }: { value: number | null; children: ReactNode; className?: string }) {
  return <span className={cn("num", value == null ? "text-muted-foreground" : value >= 0 ? "text-gain" : "text-loss", className)}>{children}</span>;
}

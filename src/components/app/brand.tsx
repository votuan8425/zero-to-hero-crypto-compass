import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span aria-hidden="true" className="lime-gradient grid h-7 w-7 place-items-center rounded-lg text-[11px] font-black text-primary-foreground">
        0→H
      </span>
      <span className="text-[15px]">ZERO <span className="text-muted-foreground">TO</span> HERO</span>
    </span>
  );
}

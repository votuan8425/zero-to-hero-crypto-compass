import { useState } from "react";
import { coinLogoUrl, displaySymbol } from "@/lib/coins";
import { cn } from "@/lib/utils";

export function CoinLogo({
  symbol,
  size = 32,
  className,
}: {
  symbol: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = coinLogoUrl(symbol);
  const label = displaySymbol(symbol);
  if (!url || failed) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-surface-raised font-semibold text-muted-foreground ring-1 ring-border",
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.max(9, size * 0.32) }}
      >
        {label.slice(0, 3)}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("shrink-0 rounded-full bg-surface-raised", className)}
      style={{ width: size, height: size }}
    />
  );
}

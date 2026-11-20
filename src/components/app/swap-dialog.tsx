import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { COINS, displaySymbol, getCoin } from "@/lib/coins";
import { saveTransaction } from "@/lib/data";
import { formatMoney, formatNumber, todayKey } from "@/lib/format";
import { metalAskPerUnit, normalizeMetalPurchase } from "@/lib/metals";
import type { Holding, Tx } from "@/lib/portfolio";
import { actionPercent, roundActionPercent, swapRate } from "@/lib/swap";
import { logActivity } from "@/lib/activity";
import { usePrices } from "@/hooks/use-app-data";
import { useUser } from "@/hooks/use-user";
import { CoinLogo } from "./coin-logo";

const parseNum = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : NaN;
};

/** Số lượng nhận được hiển thị tối đa 6 chữ số thập phân, bỏ số 0 thừa. */
const fmtReceive = (n: number) => String(Math.round(n * 1e6) / 1e6);

export function SwapDialog({
  open,
  onOpenChange,
  holdings,
  txs,
  defaultFrom,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  holdings: Holding[];
  /** Toàn bộ giao dịch — để chặn ngày đổi trước lần mua đầu của token nguồn. */
  txs: Tx[];
  defaultFrom?: string | null;
}) {
  const user = useUser();
  const qc = useQueryClient();
  const prices = usePrices();
  const usdVnd = prices.data?.usdVnd ?? null;

  const heldSymbols = useMemo(() => holdings.filter((h) => h.quantity > 0), [holdings]);
  const [from, setFrom] = useState(defaultFrom ?? heldSymbols[0]?.symbol ?? "BTC");
  // Ngày mua đầu tiên của token nguồn — ngày đổi không được trước ngày này,
  // nếu không lệnh bán chạy trước lần mua, avg cost và vốn tính sai lặng.
  const firstBuyDate = useMemo(() => {
    const dates = txs
      .filter((t) => t.symbol === from && t.quantity > 0)
      .map((t) => t.tx_date)
      .sort();
    return dates[0] ?? null;
  }, [txs, from]);
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState("USDT");
  /** Đơn vị nhận khi đích là vàng (bạc luôn theo lượng). */
  const [toUnit, setToUnit] = useState<"chỉ" | "lượng">("chỉ");
  /** Giá bán A (USD với coin, VND mỗi đơn vị lưu với vàng/bạc) — null = theo giá live. */
  const [sellPriceOverride, setSellPriceOverride] = useState<string | null>(null);
  /** Số lượng B thực nhận — null = theo ước tính từ giá live. */
  const [receiveOverride, setReceiveOverride] = useState<string | null>(null);
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFrom(defaultFrom ?? heldSymbols[0]?.symbol ?? "BTC");
    setAmount("");
    setTo("USDT");
    setToUnit("chỉ");
    setSellPriceOverride(null);
    setReceiveOverride(null);
    setDate(todayKey());
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultFrom]);

  const heldFrom = heldSymbols.find((h) => h.symbol === from)?.quantity ?? 0;
  const fromCoin = getCoin(from);
  const toCoin = getCoin(to);
  const fromMetal = fromCoin?.unit ? fromCoin : undefined;
  const toMetal = toCoin?.unit ? toCoin : undefined;
  /** Đơn vị lượng của A đang nắm (vàng: chỉ; bạc: lượng). */
  const fromUnit = fromMetal ? (fromMetal.symbol === "PAXG" ? "chỉ" : "lượng") : null;
  const receiveUnit: "chỉ" | "lượng" | null = toMetal
    ? toMetal.symbol === "PAXG"
      ? toUnit
      : "lượng"
    : null;
  /** Vàng nhận theo lượng thì 1 đơn vị hiển thị = 10 đơn vị lưu (chỉ). */
  const displayToStored = toMetal?.symbol === "PAXG" && receiveUnit === "lượng" ? 10 : 1;

  const liveFrom = prices.data?.prices[from];
  const liveTo = prices.data?.prices[to];
  /** Giá live của A theo đơn vị hiển thị nhập giá (USD với coin; VND mỗi đơn vị lưu với vàng/bạc). */
  const liveSellPrice = liveFrom ? (fromMetal ? liveFrom.vnd : liveFrom.usd) : null;
  const sellPriceNum = sellPriceOverride != null ? parseNum(sellPriceOverride) : NaN;
  /** Giá bán A thực dùng, theo USD mỗi đơn vị lưu. Vàng/bạc: giá mua vào (bid). */
  const sellPriceUsdPerStored =
    liveFrom == null
      ? null
      : fromMetal
        ? (Number.isFinite(sellPriceNum) ? sellPriceNum : liveFrom.vnd) / (usdVnd ?? NaN)
        : Number.isFinite(sellPriceNum)
          ? sellPriceNum
          : liveFrom.usd;
  /** Giá mua B theo USD mỗi đơn vị lưu. Vàng/bạc dùng giá bán ra (ask) vì mua B. */
  const buyPriceUsdPerStored = useMemo(() => {
    if (!liveTo) return null;
    if (toMetal) {
      const storedUnit = toMetal.symbol === "PAXG" ? "chỉ" : "lượng";
      const ask = metalAskPerUnit(liveTo, to, storedUnit);
      return ask != null && usdVnd ? ask / usdVnd : null;
    }
    return liveTo.usd;
  }, [liveTo, to, toMetal, usdVnd]);
  const buyPriceUsdPerDisplay =
    buyPriceUsdPerStored != null ? buyPriceUsdPerStored * displayToStored : null;

  const amountNum = parseNum(amount);
  /** Tỷ lệ: 1 A = bao nhiêu B (theo đơn vị hiển thị của B). */
  const rate =
    sellPriceUsdPerStored != null && buyPriceUsdPerDisplay
      ? swapRate(sellPriceUsdPerStored, buyPriceUsdPerDisplay)
      : null;
  /** Ước tính số B nhận được (đơn vị hiển thị), theo giá bán A đang dùng. */
  const estimate =
    Number.isFinite(amountNum) && amountNum > 0 && rate != null ? amountNum * rate : null;

  // Đổi A / B / số lượng / đơn vị nhận thì số nhận quay về ước tính mới.
  useEffect(() => {
    setReceiveOverride(null);
  }, [from, to, amount, toUnit]);

  // Xoá trắng ô nhận thì quay về ước tính (không giữ ô trống khoá nút).
  const receiveStr =
    receiveOverride != null && receiveOverride.trim() !== ""
      ? receiveOverride
      : estimate != null
        ? fmtReceive(estimate)
        : "";
  const receiveNum = parseNum(receiveStr);
  /** % số A đang nắm sẽ đổi — đây là % ghi vào nhật ký hành động. */
  const pct = actionPercent(amountNum, heldFrom);
  const pctRounded = pct != null ? roundActionPercent(pct) : null;

  /** Giá mua B thực tế mỗi đơn vị hiển thị = tiền bán A / số B thực nhận. */
  const buyPriceUsdPerDisplayActual =
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    sellPriceUsdPerStored != null &&
    Number.isFinite(sellPriceUsdPerStored) &&
    Number.isFinite(receiveNum) &&
    receiveNum > 0
      ? (amountNum * sellPriceUsdPerStored) / receiveNum
      : null;

  const canSubmit =
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    amountNum <= heldFrom &&
    from !== to &&
    rate != null &&
    sellPriceUsdPerStored != null &&
    Number.isFinite(sellPriceUsdPerStored) &&
    sellPriceUsdPerStored > 0 &&
    Number.isFinite(receiveNum) &&
    receiveNum > 0 &&
    buyPriceUsdPerDisplayActual != null &&
    date <= todayKey() &&
    (firstBuyDate == null || date >= firstBuyDate);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !user) return;
    if (amountNum > heldFrom) {
      toast.error(`Bạn chỉ đang nắm ${formatNumber(heldFrom)} ${displaySymbol(from)}.`);
      return;
    }
    if (date > todayKey()) {
      toast.error("Ngày đổi không thể ở tương lai.");
      return;
    }
    if (firstBuyDate != null && date < firstBuyDate) {
      toast.error(
        `Ngày đổi không thể trước lần mua đầu tiên của ${displaySymbol(from)} (${firstBuyDate}).`,
      );
      return;
    }
    setBusy(true);
    try {
      const swapNote = `Swap ${displaySymbol(from)} → ${displaySymbol(to)}`;
      const finalNote = [note.trim(), swapNote].filter(Boolean).join(" · ") || null;
      // Giao dịch bán A (số lượng âm). Vàng/bạc lưu giá VND chính xác.
      const sellPriceVnd = fromMetal
        ? Number.isFinite(sellPriceNum)
          ? sellPriceNum
          : liveSellPrice
        : null;
      const sellStatus = await saveTransaction(qc, user.id, {
        symbol: from,
        coin_name: fromCoin?.name ?? from,
        quantity: -amountNum,
        price_usd: sellPriceUsdPerStored as number,
        fee_usd: 0,
        price_vnd: sellPriceVnd,
        fee_vnd: null,
        tx_date: date,
        note: finalNote,
      });
      // Giao dịch mua B. Giá mua mỗi đơn vị hiển thị = tiền bán A / số B thực nhận;
      // vàng/bạc quy về đơn vị lưu (chỉ/lượng) và lưu giá VND chính xác.
      const buyVndPerDisplay = (buyPriceUsdPerDisplayActual as number) * (usdVnd ?? 0);
      const normBuy = toMetal
        ? normalizeMetalPurchase(to, receiveNum, buyVndPerDisplay, receiveUnit ?? "chỉ")
        : { quantity: receiveNum, pricePerUnit: buyPriceUsdPerDisplayActual as number };
      const buyStatus = await saveTransaction(qc, user.id, {
        symbol: to,
        coin_name: toCoin?.name ?? to,
        quantity: normBuy.quantity,
        price_usd: toMetal
          ? normBuy.pricePerUnit / (usdVnd ?? NaN)
          : (buyPriceUsdPerDisplayActual as number),
        fee_usd: 0,
        price_vnd: toMetal ? normBuy.pricePerUnit : null,
        fee_vnd: null,
        tx_date: date,
        note: finalNote,
      });
      await logActivity({
        userId: user.id,
        type: "swap",
        symbol: from,
        toSymbol: to,
        pct: pctRounded,
      });
      await qc.invalidateQueries({ queryKey: ["admin-activities", user.id] });
      toast.success(
        sellStatus === "queued" || buyStatus === "queued"
          ? "Đã lưu tạm trên thiết bị. Sẽ đồng bộ khi có mạng."
          : `Đã đổi ${formatNumber(amountNum)} ${displaySymbol(from)} sang ${formatNumber(receiveNum)} ${displaySymbol(to)}.`,
      );
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Không lưu được giao dịch đổi. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chuyển đổi token</DialogTitle>
          <DialogDescription>
            Bán một token đang nắm để đổi sang USDT hoặc một token khác. App ghi thành 2 giao dịch:
            bán {displaySymbol(from)} và mua {displaySymbol(to)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Đổi từ</Label>
            <Select
              value={from}
              onValueChange={(v) => {
                setFrom(v);
                setSellPriceOverride(null);
                if (v === to) setTo(v === "USDT" ? "BTC" : "USDT");
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {heldSymbols.map((h) => (
                  <SelectItem key={h.symbol} value={h.symbol}>
                    <span className="flex items-center gap-2">
                      <CoinLogo symbol={h.symbol} size={18} /> {h.name} · đang nắm{" "}
                      {formatNumber(h.quantity)} {displaySymbol(h.symbol)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="swap-amount">Số lượng đổi ({fromUnit ?? displaySymbol(from)})</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={heldFrom <= 0}
                onClick={() => setAmount(String(heldFrom))}
              >
                Tối đa
              </Button>
            </div>
            <Input
              id="swap-amount"
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Ví dụ: ${heldFrom > 0 ? formatNumber(heldFrom / 2) : "0,5"}`}
              className="num h-11"
            />
            {heldFrom > 0 && (
              <p className="text-xs text-muted-foreground">
                Đang nắm {formatNumber(heldFrom)} {displaySymbol(from)}
                {pctRounded != null ? ` · đổi ${pctRounded}% số đang nắm` : ""}
                {amountNum > heldFrom ? " · vượt quá số đang nắm" : ""}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Đổi sang</Label>
            <Select
              value={to}
              onValueChange={(v) => {
                setTo(v);
                if (v === "PAXG") setToUnit("chỉ");
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {COINS.filter((c) => c.symbol !== from).map((c) => (
                  <SelectItem key={c.symbol} value={c.symbol}>
                    <span className="flex items-center gap-2">
                      <CoinLogo symbol={c.symbol} size={18} /> {c.name}
                      {c.unit ? "" : ` (${displaySymbol(c.symbol)})`}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="swap-sell-price">
                Giá bán mỗi {fromUnit ?? displaySymbol(from)} ({fromMetal ? "VND" : "USDT"})
              </Label>
              {toMetal?.symbol === "PAXG" && (
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={toUnit}
                  onValueChange={(v) => v && setToUnit(v as "chỉ" | "lượng")}
                >
                  <ToggleGroupItem value="chỉ" className="h-7 px-2.5 text-xs">
                    Chỉ
                  </ToggleGroupItem>
                  <ToggleGroupItem value="lượng" className="h-7 px-2.5 text-xs">
                    Lượng
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            </div>
            <Input
              id="swap-sell-price"
              inputMode="decimal"
              value={
                sellPriceOverride ??
                (liveSellPrice != null ? String(Math.round(liveSellPrice * 1e6) / 1e6) : "")
              }
              onChange={(e) => setSellPriceOverride(e.target.value)}
              placeholder={
                liveSellPrice != null ? String(Math.round(liveSellPrice * 1e6) / 1e6) : "—"
              }
              className="num h-11"
            />
            <p className="text-xs text-muted-foreground">Mặc định theo giá live hiện tại.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="swap-receive">
              Số lượng {displaySymbol(to)} nhận được ({receiveUnit ?? displaySymbol(to)})
            </Label>
            <Input
              id="swap-receive"
              inputMode="decimal"
              required
              value={receiveStr}
              onChange={(e) => setReceiveOverride(e.target.value)}
              placeholder="—"
              className="num h-11"
            />
            <p className="text-xs text-muted-foreground">
              {rate != null && Number.isFinite(amountNum) && amountNum > 0
                ? `Ước tính: 1 ${displaySymbol(from)} = ${formatNumber(rate)} ${displaySymbol(to)} → nhận khoảng ${estimate != null ? formatNumber(estimate) : "—"} ${displaySymbol(to)}. `
                : Number.isFinite(amountNum) && amountNum > 0 && from !== to
                  ? "Chưa có giá live của một trong hai token nên chưa tính được ước tính — thử lại khi có mạng. "
                  : "Chọn đủ 2 token và nhập số lượng để xem ước tính. "}
              Thực tế trên sàn có thể nhận ít hơn do phí và trượt giá — sửa lại số này cho khớp với
              số thật trên sàn.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="swap-date">Ngày đổi</Label>
              <Input
                id="swap-date"
                type="date"
                required
                value={date}
                min={firstBuyDate ?? undefined}
                max={todayKey()}
                onChange={(e) => setDate(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="swap-note">Ghi chú</Label>
              <Input
                id="swap-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Không bắt buộc"
                className="h-11"
              />
            </div>
          </div>

          {buyPriceUsdPerDisplayActual != null && (
            <div className="flex items-center justify-between rounded-lg bg-surface-raised px-4 py-3 text-sm">
              <span className="text-muted-foreground">Giá mua {displaySymbol(to)} thực tế</span>
              <span className="num font-semibold">
                {formatMoney(buyPriceUsdPerDisplayActual, "USDT")}
              </span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" variant="hero" disabled={busy || !canSubmit}>
              {busy && <Loader2 className="animate-spin" />}
              <ArrowRightLeft /> Xác nhận đổi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

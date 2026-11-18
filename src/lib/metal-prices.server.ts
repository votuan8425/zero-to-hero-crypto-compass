import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  metalSlotAt,
  parseAncaratSilver,
  parsePnjSjc,
  parseSjcGold,
  type MetalQuote,
} from "./metals";

/** Mã nội bộ: vàng = PAXG (giá SJC mỗi chỉ), bạc = KAG (giá Ancarat mỗi lượng). */
export const METAL_SYMBOLS = { gold: "PAXG", silver: "KAG" } as const;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Giá vàng SJC mỗi chỉ: trang SJC trước, bị chặn thì lấy dòng "Vàng miếng SJC" ở PNJ. */
export async function fetchSjcGold(): Promise<MetalQuote | null> {
  try {
    const res = await fetch("https://sjc.com.vn/GoldPrice/Services/PriceService.ashx", {
      method: "POST",
      headers: {
        "user-agent": BROWSER_UA,
        accept: "application/json",
        "x-requested-with": "XMLHttpRequest",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: "method=GetCurrentGoldPricesByBranch&BranchId=1",
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    if (res.ok && text.trimStart().startsWith("{")) {
      const q = parseSjcGold(JSON.parse(text));
      if (q) return q;
    }
  } catch (e) {
    console.error("sjc gold failed", e);
  }
  try {
    const res = await fetch("https://edge-api.pnj.io/ecom-frontend/v1/get-gold-price?zone=00", {
      headers: { "user-agent": BROWSER_UA, accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return parsePnjSjc(await res.json());
  } catch (e) {
    console.error("pnj sjc failed", e);
  }
  return null;
}

/** Giá bạc Ancarat mỗi lượng, đọc từ bảng giá công khai giabac.ancarat.com. */
export async function fetchAncaratSilver(): Promise<MetalQuote | null> {
  try {
    const res = await fetch("https://giabac.ancarat.com/", {
      headers: { "user-agent": BROWSER_UA, accept: "text/html" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseAncaratSilver(await res.text());
  } catch (e) {
    console.error("ancarat silver failed", e);
  }
  return null;
}

/** Client chỉ đọc (khoá công khai) cho bảng giá vàng/bạc công khai. */
function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Thiếu cấu hình máy chủ.");
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Lấy giá mới và lưu cho mốc `slot` (06:00 / 22:00). Mốc đã có giá thì giữ nguyên. */
export async function recordMetalPrices(slot: Date): Promise<{ saved: string[] }> {
  const [gold, silver] = await Promise.all([fetchSjcGold(), fetchAncaratSilver()]);
  const pairs: [string, MetalQuote | null][] = [
    [METAL_SYMBOLS.gold, gold],
    [METAL_SYMBOLS.silver, silver],
  ];
  const rows = pairs.flatMap(([symbol, q]) =>
    q
      ? [
          {
            symbol,
            slot_at: slot.toISOString(),
            bid_vnd: q.bidVnd,
            ask_vnd: q.askVnd,
            source: q.source,
          },
        ]
      : [],
  );
  if (rows.length === 0) return { saved: [] };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("metal_prices")
    .upsert(rows, { onConflict: "symbol,slot_at", ignoreDuplicates: true });
  if (error) throw error;
  return { saved: rows.map((r) => r.symbol) };
}

export interface MetalSnapshot {
  bidVnd: number;
  askVnd: number;
  source: string;
  /** Mốc cập nhật (06:00 hoặc 22:00 giờ Việt Nam), ISO. */
  slotAt: string;
  /** % đổi giá mua vào so với mốc 24 giờ trước, null nếu chưa có. */
  change24h: number | null;
}

/**
 * Giá vàng/bạc theo mốc cập nhật gần nhất. Nếu mốc hiện tại chưa có (lịch
 * chưa chạy, lần đầu triển khai) thì lấy giá ngay và lưu cho mốc đó.
 */
export async function getMetalSnapshots(now = new Date()): Promise<Record<string, MetalSnapshot>> {
  const slot = metalSlotAt(now);
  const since = new Date(slot.getTime() - 3 * 86_400_000).toISOString();
  const db = publicClient();
  const read = async () => {
    const { data, error } = await db
      .from("metal_prices")
      .select("symbol, slot_at, bid_vnd, ask_vnd, source")
      .gte("slot_at", since)
      .order("slot_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  };
  let rows = await read();
  const symbols = Object.values(METAL_SYMBOLS);
  const hasCurrent = (s: string) =>
    rows.some((r) => r.symbol === s && new Date(r.slot_at).getTime() >= slot.getTime());
  if (!symbols.every(hasCurrent)) {
    try {
      await recordMetalPrices(slot);
      rows = await read();
    } catch (e) {
      console.error("metal lazy record failed", e);
    }
  }
  const out: Record<string, MetalSnapshot> = {};
  for (const s of symbols) {
    const mine = rows.filter((r) => r.symbol === s);
    const latest = mine[0];
    if (!latest) continue;
    const dayAgo = new Date(latest.slot_at).getTime() - 86_400_000;
    const prev = mine.find((r) => new Date(r.slot_at).getTime() === dayAgo);
    const bid = Number(latest.bid_vnd);
    const prevBid = prev ? Number(prev.bid_vnd) : NaN;
    out[s] = {
      bidVnd: bid,
      askVnd: Number(latest.ask_vnd),
      source: latest.source,
      slotAt: new Date(latest.slot_at).toISOString(),
      change24h: prevBid > 0 ? ((bid - prevBid) / prevBid) * 100 : null,
    };
  }
  return out;
}

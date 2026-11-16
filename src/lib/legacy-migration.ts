import { getCoin, normalizeSymbol } from "./coins";
import { parseDateOnly, toDateKey } from "./format";

export interface LegacyRecord {
  importKey: string;
  source: string;
  symbol: string;
  coin_name: string;
  quantity: number;
  price_usd: number;
  fee_usd: number;
  tx_date: string;
  note: string | null;
}

const pick = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (o[k] != null && o[k] !== "") return o[k];
  return undefined;
};

function hash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822507);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

function toDate(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") return toDateKey(new Date(v < 1e12 ? v * 1000 : v));
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return toDateKey(parseDateOnly(s));
  const vn = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (vn) return toDateKey(new Date(Number(vn[3]), Number(vn[2]) - 1, Number(vn[1])));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : toDateKey(d);
}

/** Converts one unknown legacy object into a purchase record, or null if it doesn't look like one. */
export function parseLegacyRecord(o: unknown, source: string): LegacyRecord | null {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  const type = String(pick(r, ["type", "side", "action"]) ?? "buy").toLowerCase();
  if (["sell", "ban", "bán"].includes(type)) return null;
  const symRaw = pick(r, ["symbol", "coin", "ticker", "asset", "token", "coinSymbol"]);
  const qtyRaw = pick(r, ["quantity", "amount", "qty", "coinAmount", "units"]);
  if (symRaw == null || qtyRaw == null) return null;
  const symbol = normalizeSymbol(String(symRaw));
  const quantity = Number(qtyRaw);
  if (!symbol || !Number.isFinite(quantity) || quantity <= 0) return null;
  let price = Number(pick(r, ["price_usd", "priceUsd", "price", "buyPrice", "unitPrice", "avgPrice"]) ?? NaN);
  const total = Number(pick(r, ["total", "totalUsd", "cost", "invested", "spent"]) ?? NaN);
  if (!Number.isFinite(price) && Number.isFinite(total)) price = total / quantity;
  if (!Number.isFinite(price) || price < 0) price = 0;
  const fee = Number(pick(r, ["fee", "fee_usd", "feeUsd"]) ?? 0);
  const tx_date = toDate(pick(r, ["tx_date", "date", "purchaseDate", "createdAt", "created_at", "timestamp", "time"])) ?? toDateKey(new Date());
  const noteRaw = pick(r, ["note", "notes", "memo", "description"]);
  const stable = JSON.stringify({ symbol, quantity, price, tx_date, id: r["id"] ?? null });
  return {
    importKey: `legacy:${hash(source + "|" + stable)}`,
    source,
    symbol,
    coin_name: getCoin(symbol)?.name ?? String(pick(r, ["name", "coinName"]) ?? symbol),
    quantity,
    price_usd: price,
    fee_usd: Number.isFinite(fee) && fee > 0 ? fee : 0,
    tx_date,
    note: noteRaw != null ? String(noteRaw) : null,
  };
}

/** Recursively finds arrays of purchase-like objects inside a parsed JSON value. */
export function extractRecords(value: unknown, source: string, depth = 0): LegacyRecord[] {
  if (depth > 4 || value == null) return [];
  if (Array.isArray(value)) {
    const direct = value.map((v) => parseLegacyRecord(v, source)).filter((x): x is LegacyRecord => !!x);
    if (direct.length > 0) return direct;
    return value.flatMap((v) => extractRecords(v, source, depth + 1));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => extractRecords(v, `${source}.${k}`, depth + 1));
  }
  return [];
}

const IGNORED_PREFIXES = ["sb-", "zth:", "supabase", "lovable", "ph_", "_"];

function scanLocalStorage(): LegacyRecord[] {
  const out: LegacyRecord[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || IGNORED_PREFIXES.some((p) => k.startsWith(p))) continue;
    const raw = localStorage.getItem(k);
    if (!raw || (raw[0] !== "[" && raw[0] !== "{")) continue;
    try {
      out.push(...extractRecords(JSON.parse(raw), `localStorage:${k}`));
    } catch {
      /* not JSON */
    }
  }
  return out;
}

async function scanIndexedDb(): Promise<LegacyRecord[]> {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") return [];
  const out: LegacyRecord[] = [];
  const dbs = await indexedDB.databases().catch(() => []);
  for (const info of dbs) {
    if (!info.name || IGNORED_PREFIXES.some((p) => info.name!.startsWith(p)) || info.name.includes("firebase")) continue;
    const db = await new Promise<IDBDatabase | null>((resolve) => {
      const req = indexedDB.open(info.name!);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onupgradeneeded = () => { req.transaction?.abort(); resolve(null); };
    });
    if (!db) continue;
    for (const store of Array.from(db.objectStoreNames)) {
      const rows = await new Promise<unknown[]>((resolve) => {
        try {
          const req = db.transaction(store, "readonly").objectStore(store).getAll();
          req.onsuccess = () => resolve(req.result as unknown[]);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
      out.push(...extractRecords(rows, `indexedDB:${info.name}/${store}`));
    }
    db.close();
  }
  return out;
}

/** Scans this browser's local storage and IndexedDB for purchases saved by an earlier version. */
export async function scanLegacyData(): Promise<LegacyRecord[]> {
  if (typeof window === "undefined") return [];
  const all = [...scanLocalStorage(), ...(await scanIndexedDb())];
  const seen = new Set<string>();
  return all.filter((r) => (seen.has(r.importKey) ? false : (seen.add(r.importKey), true)));
}

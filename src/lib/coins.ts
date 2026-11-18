export interface CoinInfo {
  symbol: string;
  name: string;
  geckoId: string;
  /** Đơn vị số lượng của kim loại quý: vàng tính theo chỉ, bạc theo lượng. */
  unit?: "chỉ" | "lượng";
  /** Nguồn giá trong nước của kim loại quý (hiển thị thay cho mã). */
  priceSource?: string;
  /** Chữ hiện trong biểu tượng khi không có ảnh logo (VD: bạc → "Ag"). */
  logoText?: string;
}

/** Popular coins supported for accumulation, with CoinGecko ids for live prices. */
export const COINS: CoinInfo[] = [
  { symbol: "BTC", name: "Bitcoin", geckoId: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", geckoId: "ethereum" },
  { symbol: "PAXG", name: "Vàng", geckoId: "pax-gold", unit: "chỉ", priceSource: "SJC", logoText: "Au" },
  { symbol: "KAG", name: "Bạc", geckoId: "kinesis-silver", unit: "lượng", priceSource: "Ancarat", logoText: "Ag" },
  { symbol: "SOL", name: "Solana", geckoId: "solana" },
  { symbol: "BNB", name: "BNB", geckoId: "binancecoin" },
  { symbol: "XRP", name: "XRP", geckoId: "ripple" },
  { symbol: "USDT", name: "Tether", geckoId: "tether" },
  { symbol: "ADA", name: "Cardano", geckoId: "cardano" },
  { symbol: "DOGE", name: "Dogecoin", geckoId: "dogecoin" },
  { symbol: "TRX", name: "TRON", geckoId: "tron" },
  { symbol: "TON", name: "Toncoin", geckoId: "the-open-network" },
  { symbol: "AVAX", name: "Avalanche", geckoId: "avalanche-2" },
  { symbol: "LINK", name: "Chainlink", geckoId: "chainlink" },
  { symbol: "DOT", name: "Polkadot", geckoId: "polkadot" },
  { symbol: "SUI", name: "Sui", geckoId: "sui" },
  { symbol: "NEAR", name: "NEAR Protocol", geckoId: "near" },
  { symbol: "LTC", name: "Litecoin", geckoId: "litecoin" },
  { symbol: "HYPE", name: "Hyperliquid", geckoId: "hyperliquid" },
  { symbol: "OKB", name: "OKB", geckoId: "okb" },
];

const BY_SYMBOL = new Map(COINS.map((c) => [c.symbol, c]));

export const OTHER_SYMBOL = "KHAC";

export function normalizeSymbol(raw: string): string {
  const s = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (["OTHER", "OTHERS", "KHAC", "CONLAI", "REST"].includes(s)) return OTHER_SYMBOL;
  if (s === "MATIC") return "POL";
  return s;
}

export function getCoin(symbol: string): CoinInfo | undefined {
  return BY_SYMBOL.get(normalizeSymbol(symbol));
}

export function coinName(symbol: string, fallback?: string | null): string {
  if (normalizeSymbol(symbol) === OTHER_SYMBOL) return "Khác";
  return getCoin(symbol)?.name ?? fallback ?? symbol;
}

export function coinLogoUrl(symbol: string): string | null {
  const s = normalizeSymbol(symbol);
  if (!s || s === OTHER_SYMBOL) return null;
  // Vàng/bạc dùng logo thỏi vẽ riêng (nền tròn như các token khác),
  // không dùng logo token PAXG/KAG trên CoinCap.
  if (s === "PAXG") return "/coin-logos/paxg.svg";
  if (s === "KAG") return "/coin-logos/kag.svg";
  return `https://assets.coincap.io/assets/icons/${s.toLowerCase()}@2x.png`;
}

/** 1 ounce vàng = 8,29426048 chỉ (1 chỉ = 3,75 g; 1 ounce troy = 31,1034768 g). */
export const OUNCE_TO_CHI = 31.1034768 / 3.75;
/** 1 ounce bạc = 0,82942605 lượng (1 lượng = 37,5 g). */
export const OUNCE_TO_LUONG = 31.1034768 / 37.5;

export function displaySymbol(symbol: string): string {
  const s = normalizeSymbol(symbol);
  const coin = getCoin(s);
  // Vàng/bạc chỉ hiện tên tiếng Việt ("Vàng"/"Bạc") — không hiện mã
  // PAXG/KAG hay nguồn SJC/Ancarat. Nguồn giá vẫn nằm ở `priceSource`
  // và chỉ hiện trong phần giải thích của biểu đồ giá.
  if (coin?.unit) return coin.name;
  if (s === OTHER_SYMBOL) return "Khác";
  return coin?.priceSource ?? s;
}

/** Đơn vị hiển thị sau số lượng: "chỉ" (vàng), "lượng" (bạc), còn lại là mã coin. */
export function quantityUnit(symbol: string): string {
  return getCoin(symbol)?.unit ?? displaySymbol(symbol);
}

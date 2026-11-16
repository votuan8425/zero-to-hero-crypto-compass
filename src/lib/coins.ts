export interface CoinInfo {
  symbol: string;
  name: string;
  geckoId: string;
}

/** Popular coins supported for accumulation, with CoinGecko ids for live prices. */
export const COINS: CoinInfo[] = [
  { symbol: "BTC", name: "Bitcoin", geckoId: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", geckoId: "ethereum" },
  { symbol: "SOL", name: "Solana", geckoId: "solana" },
  { symbol: "BNB", name: "BNB", geckoId: "binancecoin" },
  { symbol: "XRP", name: "XRP", geckoId: "ripple" },
  { symbol: "USDT", name: "Tether", geckoId: "tether" },
  { symbol: "USDC", name: "USD Coin", geckoId: "usd-coin" },
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
  { symbol: "POL", name: "Polygon", geckoId: "polygon-ecosystem-token" },
  { symbol: "ARB", name: "Arbitrum", geckoId: "arbitrum" },
  { symbol: "OP", name: "Optimism", geckoId: "optimism" },
  { symbol: "APT", name: "Aptos", geckoId: "aptos" },
  { symbol: "ATOM", name: "Cosmos", geckoId: "cosmos" },
  { symbol: "UNI", name: "Uniswap", geckoId: "uniswap" },
  { symbol: "INJ", name: "Injective", geckoId: "injective-protocol" },
  { symbol: "TAO", name: "Bittensor", geckoId: "bittensor" },
  { symbol: "HYPE", name: "Hyperliquid", geckoId: "hyperliquid" },
  { symbol: "ENA", name: "Ethena", geckoId: "ethena" },
  { symbol: "OKB", name: "OKB", geckoId: "okb" },
  { symbol: "PEPE", name: "Pepe", geckoId: "pepe" },
  { symbol: "SHIB", name: "Shiba Inu", geckoId: "shiba-inu" },
];

const BY_SYMBOL = new Map(COINS.map((c) => [c.symbol, c]));

export const OTHER_SYMBOL = "KHAC";

export function normalizeSymbol(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
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
  return `https://assets.coincap.io/assets/icons/${s.toLowerCase()}@2x.png`;
}

export function displaySymbol(symbol: string): string {
  const s = normalizeSymbol(symbol);
  return s === OTHER_SYMBOL ? "Khác" : s;
}

import { describe, expect, it } from "vitest";
import {
  DEFAULT_FAVORITES,
  MAX_FAVORITES,
  loadFavorites,
  toggleFavorite,
} from "@/lib/favorites";

function withStorage(value: string | null) {
  const store = new Map<string, string>();
  if (value !== null) store.set("zth:favorite-coins", value);
  const getItem = (k: string) => store.get(k) ?? null;
  const setItem = (k: string, v: string) => {
    store.set(k, v);
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: { getItem, setItem, removeItem: (k: string) => store.delete(k) },
    configurable: true,
  });
}

describe("favorites", () => {
  it("mặc định là BTC, ETH, Vàng khi chưa lưu gì", () => {
    withStorage(null);
    expect(loadFavorites()).toEqual([...DEFAULT_FAVORITES]);
  });

  it("tối đa 3 coin: thêm coin thứ 4 bị từ chối", () => {
    expect(MAX_FAVORITES).toBe(3);
    const full = ["BTC", "ETH", "PAXG"];
    const res = toggleFavorite("SOL", full);
    expect(res.list).toEqual(full);
    expect(res.error).toMatch(/tối đa 3/);
  });

  it("bấm lại coin đã ghim thì bỏ ghim", () => {
    const res = toggleFavorite("ETH", ["BTC", "ETH", "PAXG"]);
    expect(res.list).toEqual(["BTC", "PAXG"]);
    expect(res.error).toBeUndefined();
  });

  it("ghim coin mới khi còn chỗ thì thêm vào cuối", () => {
    const res = toggleFavorite("SOL", ["BTC", "ETH"]);
    expect(res.list).toEqual(["BTC", "ETH", "SOL"]);
  });

  it("bỏ qua symbol lạ khi đọc storage", () => {
    withStorage(JSON.stringify(["BTC", "NOPE", "ETH", "ETH"]));
    expect(loadFavorites()).toEqual(["BTC", "ETH"]);
  });
});

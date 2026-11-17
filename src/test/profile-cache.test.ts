import { beforeEach, describe, expect, it } from "vitest";
import { profileQuery } from "@/lib/data";

const USER = "user-1";
const KEY = `zth:cache:profile:${USER}`;

/** localStorage thật trong môi trường test (jsdom dưới Bun) không đầy đủ nên
 *  dùng bản stub theo mẫu favorites.test.ts. */
function withStorage(entries: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(entries));
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
    },
    configurable: true,
  });
}

function initialDataOf(userId: string) {
  const opts = profileQuery(userId);
  const init = opts.initialData;
  return typeof init === "function" ? init() : init;
}

describe("profileQuery initialData (snapshot)", () => {
  beforeEach(() => {
    withStorage();
  });

  it("dùng hồ sơ đã lưu (USDT) làm dữ liệu ban đầu để không hiện tạm VND", () => {
    withStorage({
      [KEY]: JSON.stringify({
        id: USER,
        display_name: "Tuấn",
        currency: "USDT",
        settings: {},
        local_migrated_at: null,
      }),
    });
    expect(initialDataOf(USER)?.currency).toBe("USDT");
    expect(initialDataOf(USER)?.display_name).toBe("Tuấn");
  });

  it("không có snapshot thì không có dữ liệu ban đầu", () => {
    expect(initialDataOf(USER)).toBeUndefined();
  });

  it("snapshot cũ lưu USD được chuẩn hoá thành USDT", () => {
    withStorage({
      [KEY]: JSON.stringify({
        id: USER,
        display_name: null,
        currency: "USD",
        settings: {},
        local_migrated_at: null,
      }),
    });
    expect(initialDataOf(USER)?.currency).toBe("USDT");
  });
});

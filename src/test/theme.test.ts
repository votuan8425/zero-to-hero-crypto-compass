import { beforeEach, describe, expect, it } from "vitest";
import { currentTheme, readStoredTheme, setTheme, THEME_INIT_SCRIPT } from "@/lib/theme";

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

describe("theme (tối/trắng)", () => {
  beforeEach(() => {
    withStorage();
    document.documentElement.classList.remove("dark", "theme-anim");
  });

  it("mặc định là tối khi chưa lưu gì", () => {
    expect(readStoredTheme()).toBe("dark");
  });

  it("đọc đúng lựa chọn trắng đã lưu", () => {
    withStorage({ "zth:theme": "light" });
    expect(readStoredTheme()).toBe("light");
  });

  it("giá trị lạ thì về tối", () => {
    withStorage({ "zth:theme": "blue" });
    expect(readStoredTheme()).toBe("dark");
  });

  it("setTheme gắn/bỏ class .dark trên <html> và lưu lại", () => {
    setTheme("light");
    expect(currentTheme()).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("zth:theme")).toBe("light");
    setTheme("dark");
    expect(currentTheme()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("zth:theme")).toBe("dark");
  });

  it("script khởi tạo trong <head> mặc định tối và đọc đúng key", () => {
    expect(THEME_INIT_SCRIPT).toContain("zth:theme");
    expect(THEME_INIT_SCRIPT).toContain("dark");
  });
});

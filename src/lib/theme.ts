import { useSyncExternalStore } from "react";

/**
 * Giao diện tối / trắng của app — lưu trên thiết bị này (localStorage),
 * mặc định là tối. Theme được áp bằng class .dark trên <html> (xem
 * src/styles.css: :root là trắng, :root.dark là tối). Class này do script
 * trong <head> (src/routes/__root.tsx) gắn ngay lúc tải trang để không bị
 * nháy, React không quản lý class đó để tránh lệch hydration.
 */
export type Theme = "dark" | "light";

export const THEME_KEY = "zth:theme";

export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Theme hiện tại, đọc từ class .dark trên <html> (mặc định tối). */
export function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

const listeners = new Set<() => void>();

function subscribeTheme(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notifyTheme() {
  listeners.forEach((l) => l());
}

/** Đổi giao diện: lưu lại, gắn/bỏ class .dark, kèm hiệu ứng chuyển màu mượt. */
export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* bỏ qua */
  }
  if (typeof document !== "undefined") {
    const el = document.documentElement;
    el.classList.add("theme-anim");
    el.classList.toggle("dark", theme === "dark");
    window.setTimeout(() => el.classList.remove("theme-anim"), 400);
  }
  notifyTheme();
}

/** Theme cho giao diện React (nút chuyển ở Cá nhân). */
export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "dark");
  return [theme, setTheme];
}

/** Script chạy ngay trong <head> để gắn .dark trước khi trang vẽ lần đầu
 *  (không nháy giao diện). Mặc định tối khi chưa lưu gì. */
export const THEME_INIT_SCRIPT =
  "try{if(localStorage.getItem('zth:theme')!=='light'){document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}";

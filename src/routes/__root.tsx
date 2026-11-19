import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SplashScreen } from "@/components/app/splash-screen";
import { supabase } from "@/integrations/supabase/client";
import { isNetworkError, profileQuery, referencesQuery, transactionsQuery } from "@/lib/data";
import { fetchPublishedAllocations, publishedAllocationsKey } from "@/lib/admin-allocation";
import { pricesQuery } from "@/hooks/use-app-data";
import { portfolioHistoryQuery, type HistorySeries } from "@/hooks/use-portfolio-history";
import { computeHoldings, computeTotals, type Tx } from "@/lib/portfolio";
import {
  computePortfolioHistory,
  historyPeriodDays,
  withLiveEndpoint,
} from "@/lib/portfolio-history";
import type { PricesResult } from "@/lib/prices.functions";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Không tìm thấy trang</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Trang bạn tìm không tồn tại hoặc đã được chuyển đi.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Trang chưa tải được
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Đã có lỗi xảy ra. Bạn có thể thử tải lại hoặc quay về trang chủ.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Thử lại
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Về trang chủ
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0b0b0b" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Zero to Hero" },
      { title: "ZERO TO HERO — Tích sản tiền mã hoá" },
      {
        name: "description",
        content:
          "Nền tảng tích sản và quản lý danh mục tiền mã hoá bằng tiếng Việt, đồng bộ đám mây trên mọi thiết bị.",
      },
      { property: "og:title", content: "ZERO TO HERO — Tích sản tiền mã hoá" },
      {
        property: "og:description",
        content: "Một tài khoản. Nhiều thiết bị. Một danh mục đồng bộ.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "vi_VN" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // Không gắn className ở đây: giao diện tối/trắng do script trong <head>
    // gắn class .dark ngay lúc tải trang (tránh nháy + tránh lệch hydration).
    <html lang="vi" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  // Màn hình chờ lúc mở app (dù đã đăng nhập hay chưa): logo + vòng xoay tròn,
  // hiện ít nhất 2 giây. Với tài khoản đã đăng nhập, màn hình chờ NẠP TOÀN BỘ
  // dữ liệu app VÀ CODE của tất cả tab trước khi cho vào (giao dịch, hồ sơ, giá
  // thị trường, danh mục tham khảo, nhà đầu tư đã đăng + JS chunk của 4 tab) —
  // vào app rồi thì Trang chủ có sẵn dữ liệu, chuyển tab nào (Tích sản, Cá nhân,
  // Tham khảo) cũng có sẵn cả code lẫn dữ liệu, không phải chờ tải lần đầu.
  // Riêng TỔNG GIÁ TRỊ ƯỚC TÍNH: chỉ cho vào app khi đã tính được từ data giá
  // thật vừa nạp (token BTC/ETH… từ OKX/CoinGecko + vàng/bạc SJC/Ancarat);
  // chưa tính được thì ở ngoài màn hình chờ xoay xoay, tải lại giá và chờ thêm.
  // Rồi CHART và PNL: cũng chỉ cho vào khi chart đã hiện được (có điểm vẽ,
  // tức có màu xanh/đỏ theo xu hướng) và PNL lãi/lỗ kỳ mặc định (1 tháng)
  // đã tính được từ nến thật — chưa đủ thì nạp nốt nến và chờ thêm.
  // Chờ tối đa 15 giây để không kẹt mãi khi mạng yếu (quá 15s thì vẫn vào app
  // với dữ liệu đã có / đã lưu, phần còn thiếu tự tải nốt trong nền). Chỉ chạy
  // khi tải lại trang / mở app (component này chỉ mount một lần), không hiện
  // lại khi chuyển tab.
  const [booted, setBooted] = useState(false);
  const [bootStatus, setBootStatus] = useState<string | undefined>(undefined);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  // Đăng ký service worker 1 lần lúc mở app: cần cho Web Push và để trình
  // duyệt cho cài app về màn hình chính (PWA). Không hỏi quyền ở đây.
  useEffect(() => {
    void import("@/lib/push").then(({ registerServiceWorker }) => registerServiceWorker());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const bootStart = Date.now();
      const BUDGET_MS = 15000;
      const remaining = () => BUDGET_MS - (Date.now() - bootStart);
      const minWait = sleep(2000);
      try {
        let userId: string | null = null;
        const { data, error } = await supabase.auth.getUser();
        if (data.user) {
          userId = data.user.id;
        } else if (error && isNetworkError(error)) {
          const { data: s } = await supabase.auth.getSession();
          if (s.session) userId = s.session.user.id;
        }
        if (userId) {
          // Nạp toàn bộ dữ liệu app song song trước khi cho vào — giao dịch,
          // hồ sơ, giá thị trường, danh mục tham khảo, nhà đầu tư đã đăng.
          // Đồng thời nạp trước code (JS chunk) của tất cả tab bằng
          // router.preloadRoute — lần đầu chuyển tab không phải tải chunk
          // nên không chậm (chỉ prefetch dữ liệu thôi thì chưa đủ, vì mỗi tab
          // là một chunk riêng, lần đầu vào tab nào cũng phải tải chunk đó).
          // allSettled: một nguồn lỗi cũng không chặn các nguồn khác.
          await Promise.race([
            Promise.allSettled([
              queryClient.prefetchQuery(transactionsQuery(userId)),
              queryClient.prefetchQuery(profileQuery(userId)),
              queryClient.prefetchQuery(pricesQuery),
              queryClient.prefetchQuery(referencesQuery(userId)),
              queryClient.prefetchQuery({
                queryKey: publishedAllocationsKey,
                queryFn: fetchPublishedAllocations,
                staleTime: 60_000,
              }),
              router.preloadRoute({ to: "/trang-chu" }),
              router.preloadRoute({ to: "/tich-san" }),
              router.preloadRoute({ to: "/ca-nhan" }),
              router.preloadRoute({ to: "/tham-khao" }),
            ]),
            sleep(BUDGET_MS),
          ]);
          // Tính giá trị ước tính từ data vừa nạp (token OKX/CoinGecko +
          // vàng/bạc SJC/Ancarat + giao dịch); chỉ vào app khi ước tính đã
          // tính được từ giá thật — chưa có giao dịch nào thì ước tính = 0,
          // cũng coi là tính được. Chưa tính được (thiếu giá một đồng nào đó)
          // thì tải lại giá và chờ thêm trong thời gian còn lại của 15s.
          if (!cancelled && remaining() > 0) {
            setBootStatus("Đang tính giá trị ước tính…");
            for (;;) {
              const txs = queryClient.getQueryData<Tx[]>(transactionsQuery(userId).queryKey) ?? [];
              const pricesData = queryClient.getQueryData<PricesResult>(pricesQuery.queryKey);
              const holdings = computeHoldings(txs, pricesData?.prices ?? {});
              const value = computeTotals(holdings).valueUsd;
              if (holdings.length === 0 || value != null || cancelled || remaining() <= 0) {
                break;
              }
              // type: "all" vì lúc boot chưa có component nào observe query
              // giá (inactive) nên refetch mặc định sẽ bỏ qua nó.
              await queryClient.refetchQueries({
                queryKey: pricesQuery.queryKey,
                type: "all",
              });
              if (cancelled || remaining() <= 0) break;
              await sleep(Math.min(1000, remaining()));
            }
          }
          // Chart và PNL kỳ mặc định (1 tháng): chỉ vào app khi chart đã
          // hiện được (có điểm vẽ → có màu xanh/đỏ theo xu hướng) và PNL
          // lãi/lỗ đã tính được từ nến thật. Chưa có giao dịch nào thì
          // không có chart/PNL để chờ, vào luôn. Nạp nến bằng cùng query
          // trang chủ dùng (đã có trong cache thì prefetch không gọi lại);
          // nến lỗi thì chờ 1s rồi nạp lại trong thời gian còn lại.
          if (!cancelled && remaining() > 0) {
            setBootStatus("Đang tải biểu đồ và tính lãi/lỗ…");
            for (;;) {
              const txs = queryClient.getQueryData<Tx[]>(transactionsQuery(userId).queryKey) ?? [];
              const pricesData = queryClient.getQueryData<PricesResult>(pricesQuery.queryKey);
              const holdings = computeHoldings(txs, pricesData?.prices ?? {});
              const value = computeTotals(holdings).valueUsd;
              if (holdings.length === 0 || cancelled || remaining() <= 0) break;
              if (value == null) {
                await queryClient.refetchQueries({
                  queryKey: pricesQuery.queryKey,
                  type: "all",
                });
                if (cancelled || remaining() <= 0) break;
                await sleep(Math.min(1000, remaining()));
                continue;
              }
              const options = portfolioHistoryQuery(
                // Nạp cả đồng đã bán/đổi hết (không còn trong holdings)
                // để chart 1M tính được sau khi swap toàn bộ một token.
                [...new Set([...holdings.map((h) => h.symbol), ...txs.map((t) => t.symbol)])],
                pricesData?.prices,
                "1M",
              );
              await queryClient.prefetchQuery(options).catch(() => undefined);
              const data = queryClient.getQueryData<HistorySeries>(options.queryKey);
              const ready =
                data != null &&
                (() => {
                  const toMs = Date.now();
                  const fromMs = toMs - historyPeriodDays("1M") * 86_400_000;
                  const h = withLiveEndpoint(
                    computePortfolioHistory(txs, data.daily, fromMs, toMs),
                    toMs,
                    value,
                  );
                  return h.points.length > 0 && h.pnl != null;
                })();
              if (ready || cancelled || remaining() <= 0) break;
              await sleep(Math.min(1000, remaining()));
            }
          }
        }
      } catch {
        // Lỗi lúc tải dữ liệu thì vẫn vào app sau 2 giây.
      } finally {
        await minWait;
        if (!cancelled) setBooted(true);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        {booted ? <Outlet /> : <SplashScreen status={bootStatus} />}
        <Toaster position="top-center" richColors theme="dark" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

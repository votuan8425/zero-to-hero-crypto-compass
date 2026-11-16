import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BookMarked, Cloud, Flame, ScanLine, ShieldCheck, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/app/brand";
import heroImage from "@/assets/hero-ascent.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZERO TO HERO — Tích sản tiền mã hoá, đồng bộ mọi thiết bị" },
      { name: "description", content: "Ghi lại từng lần tích sản Bitcoin, Ethereum, Solana… theo dõi lãi/lỗ, chuỗi tích sản và phân tích danh mục tham khảo bằng AI. Hoàn toàn bằng tiếng Việt." },
      { property: "og:title", content: "ZERO TO HERO — Tích sản tiền mã hoá" },
      { property: "og:description", content: "Một tài khoản. Nhiều thiết bị. Một danh mục đồng bộ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Flame, title: "Chuỗi tích sản", text: "Theo dõi số ngày tích sản liên tiếp và lịch tích sản theo tháng." },
  { icon: Cloud, title: "Đồng bộ đám mây", text: "Mua trên điện thoại, xem ngay trên máy tính — tự động, thời gian thực." },
  { icon: ScanLine, title: "AI đọc ảnh danh mục", text: "Tải ảnh chụp danh mục, AI trích xuất coin và tỷ lệ phân bổ." },
  { icon: ShieldCheck, title: "Riêng tư tuyệt đối", text: "Dữ liệu và ảnh chụp chỉ chủ tài khoản mới xem được." },
];

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <BrandMark />
        <Button asChild variant="surface" size="sm" className="rounded-full">
          <Link to={signedIn ? "/trang-chu" : "/auth"}>{signedIn ? "Vào ứng dụng" : "Đăng nhập"}</Link>
        </Button>
      </header>

      <section className="relative overflow-hidden">
        <img src={heroImage} alt="" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover object-right opacity-70 md:opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/10" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-16 md:pb-36 md:pt-28">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Smartphone className="h-3.5 w-3.5" /> Một tài khoản · Nhiều thiết bị · Một danh mục
          </p>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Tích sản đều đặn.<br />
            <span className="text-gradient-lime">Từ Zero đến Hero.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
            Ghi lại từng lần mua Bitcoin, Ethereum, Solana… theo dõi tổng tài sản, lãi/lỗ và chuỗi tích sản — đồng bộ tức thì trên mọi trình duyệt và điện thoại.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="xl">
              <Link to={signedIn ? "/trang-chu" : "/auth"}>{signedIn ? "Mở danh mục của tôi" : "Bắt đầu miễn phí"} <ArrowRight /></Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-3 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="panel p-5">
            <f.icon className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <BookMarked className="mx-auto mb-2 h-4 w-4" />
        ZERO TO HERO không phải lời khuyên đầu tư. Mọi quyết định đầu tư là của riêng bạn.
      </footer>
    </div>
  );
}

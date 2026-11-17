import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandMark } from "@/components/app/brand";
import { GoogleG } from "@/components/app/google-g";
import { translateAuthError } from "@/lib/auth-errors";

function safeRedirect(value: unknown): string {
  if (typeof value !== "string") return "/trang-chu";
  try {
    const url = new URL(value, "http://x");
    if (value.startsWith("http") && typeof window !== "undefined" && url.origin !== window.location.origin) return "/trang-chu";
    const path = url.pathname + url.search;
    return path.startsWith("/") && !path.startsWith("//") && path !== "/auth" ? path : "/trang-chu";
  } catch {
    return "/trang-chu";
  }
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => (typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {}),
  head: () => ({
    meta: [
      { title: "Đăng nhập — ZERO TO HERO" },
      { name: "description", content: "Đăng nhập hoặc tạo tài khoản ZERO TO HERO để đồng bộ danh mục tích sản trên mọi thiết bị." },
      { property: "og:title", content: "Đăng nhập — ZERO TO HERO" },
      { property: "og:description", content: "Một tài khoản, đồng bộ trên mọi thiết bị." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const target = safeRedirect(search.redirect);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    sessionStorage.setItem("zth:after-login", target);
    const go = () => navigate({ to: sessionStorage.getItem("zth:after-login") ?? "/trang-chu", replace: true });
    supabase.auth.getSession().then(({ data }) => { if (data.session) void go(); });
    const { data } = supabase.auth.onAuthStateChange((event, session) => { if (event === "SIGNED_IN" && session) void go(); });
    return () => data.subscription.unsubscribe();
  }, [navigate, target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/auth", data: { display_name: name || undefined } },
        });
        if (error) throw error;
        if (!data.session) setNotice("Đã tạo tài khoản! Vui lòng kiểm tra email và bấm vào liên kết xác nhận để đăng nhập.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setNotice("Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.");
      }
    } catch (err) {
      toast.error(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (result.error) toast.error(translateAuthError(result.error));
  }

  return (
    <div className="hero-glow flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8"><BrandMark className="text-lg" /></div>
      <div className="panel w-full max-w-md p-6 sm:p-8">
        {mode === "forgot" ? (
          <>
            <h1 className="text-xl font-bold">Quên mật khẩu</h1>
            <p className="mt-1 text-sm text-muted-foreground">Nhập email để nhận liên kết đặt lại mật khẩu.</p>
          </>
        ) : (
          <Tabs value={mode} onValueChange={(v) => { setMode(v as "signin" | "signup"); setNotice(null); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Đăng nhập</TabsTrigger>
              <TabsTrigger value="signup">Đăng ký</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" />
            <TabsContent value="signup" />
          </Tabs>
        )}

        {mode !== "forgot" && (
          <div className="mt-6 space-y-2.5">
            <Button type="button" variant="google" className="h-11 w-full" onClick={() => void social("google")}>
              <GoogleG /> Tiếp tục với Google
            </Button>
            <Button type="button" variant="outline" className="h-11 w-full" onClick={() => void social("lovable")}>
              <LovableMark className="size-[18px]" /> Tiếp tục với Lovable
            </Button>
            <div className="flex items-center gap-3 py-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> hoặc dùng email <span className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Tên hiển thị</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Minh Tuấn" autoComplete="nickname" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" autoComplete="email" />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mật khẩu</Label>
                {mode === "signin" && (
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setMode("forgot"); setNotice(null); }}>Quên mật khẩu?</button>
                )}
              </div>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </div>
          )}
          {notice && <p className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{notice}</p>}
          <Button type="submit" variant="hero" className="h-11 w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === "signin" ? "Đăng nhập" : mode === "signup" ? "Tạo tài khoản" : "Gửi liên kết đặt lại"}
          </Button>
          {mode === "forgot" && (
            <button type="button" className="w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>← Quay lại đăng nhập</button>
          )}
        </form>
      </div>
      <p className="mt-6 max-w-sm text-center text-xs text-muted-foreground">Dữ liệu của bạn được lưu riêng tư trên đám mây và đồng bộ trên mọi thiết bị đăng nhập cùng tài khoản.</p>
    </div>
  );
}

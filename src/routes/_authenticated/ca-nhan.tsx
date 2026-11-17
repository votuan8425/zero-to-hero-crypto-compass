import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  CloudUpload,
  Download,
  KeyRound,
  Loader2,
  LogOut,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  SunMoon,
  Upload,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/app/app-shell";
import { useSync } from "@/components/app/sync-provider";
import { useProfile, useReferences, useTransactions } from "@/hooks/use-app-data";
import { useUser } from "@/hooks/use-user";
import { profileKey, refsKey, txKey, updateProfile } from "@/lib/data";
import { isAdminUser } from "@/lib/admin";
import { buildBackup, downloadJson, importLegacy, parseBackup, restoreBackup } from "@/lib/backup";
import { scanLegacyData } from "@/lib/legacy-migration";
import {
  CURRENCY_OPTIONS,
  formatDate,
  formatDateTime,
  formatNumber,
  todayKey,
  type Currency,
} from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { translateAuthError } from "@/lib/auth-errors";
import { authEmailToUsername, isSyntheticAuthEmail } from "@/lib/username-auth";
import { displaySymbol } from "@/lib/coins";

export const Route = createFileRoute("/_authenticated/ca-nhan")({
  head: () => ({
    meta: [
      { title: "Cá nhân — ZERO TO HERO" },
      {
        name: "description",
        content: "Tài khoản, cài đặt, đồng bộ, sao lưu và khôi phục dữ liệu.",
      },
      { property: "og:title", content: "Cá nhân — ZERO TO HERO" },
      { property: "og:description", content: "Quản lý tài khoản và dữ liệu của bạn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonalPage,
});

function Section({
  id,
  icon,
  title,
  description,
  children,
}: {
  id?: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="panel scroll-mt-24 p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-raised text-primary">
          {icon}
        </div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function PersonalPage() {
  const user = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const txs = useTransactions();
  const refs = useReferences();
  const sync = useSync();
  const [name, setName] = useState(() => profile?.display_name ?? "");
  const [currency, setCurrency] = useState<Currency>(() => profile?.currency ?? "VND");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setCurrency(profile.currency);
    }
  }, [profile]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(user.id, { display_name: name.trim() || null, currency });
      await qc.invalidateQueries({ queryKey: profileKey(user.id) });
      toast.success("Đã lưu cài đặt.");
    } catch {
      // Lưu thất bại (ví dụ chưa chạy migration 0004 nên USDT/KRW chưa lưu được):
      // trả select về giá trị đã lưu để không hiển thị sai.
      if (profile) setCurrency(profile.currency);
      toast.error("Không lưu được cài đặt. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  const provider = (user.app_metadata?.provider as string | undefined) ?? "email";
  const isAdmin = isAdminUser(user);
  const storedUsername =
    typeof user.user_metadata?.["username"] === "string"
      ? (user.user_metadata["username"] as string)
      : null;
  const username = storedUsername ?? authEmailToUsername(user.email);
  const isSynthetic = isSyntheticAuthEmail(user.email);
  const realEmail = isSynthetic ? null : (user.email ?? null);
  const providerLabel =
    provider === "google"
      ? "Google"
      : provider === "lovable"
        ? "Lovable"
        : isSynthetic
          ? "tài khoản"
          : "email";

  return (
    <div>
      <PageHeader title="Cá nhân" subtitle={`Tài khoản: ${username}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          icon={<UserRound className="h-4 w-4" />}
          title="Tài khoản"
          description={`Đăng nhập bằng ${providerLabel}. Tham gia từ ${formatDate(new Date(user.created_at))}.`}
        >
          <dl className="mb-4 grid gap-2 text-sm">
            <div className="flex justify-between gap-3 rounded-lg bg-surface-raised px-3 py-2">
              <dt className="text-muted-foreground">Tài khoản</dt>
              <dd className="font-medium">{username || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3 rounded-lg bg-surface-raised px-3 py-2">
              <dt className="text-muted-foreground">Vai trò</dt>
              <dd>
                {isAdmin ? (
                  <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/15">
                    <ShieldCheck className="h-3 w-3" /> Quản trị viên
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <UserRound className="h-3 w-3" /> Người dùng
                  </Badge>
                )}
              </dd>
            </div>
            {realEmail && (
              <div className="flex justify-between gap-3 rounded-lg bg-surface-raised px-3 py-2">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{realEmail}</dd>
              </div>
            )}
          </dl>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dn">Tên hiển thị</Label>
              <Input
                id="dn"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tên của bạn"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Đơn vị tiền tệ hiển thị</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="hero" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Lưu cài đặt
            </Button>
          </form>
        </Section>

        <ThemeSection />

        <Section
          icon={sync.online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          title="Đồng bộ đám mây"
          description="Dữ liệu tự động đồng bộ trên mọi thiết bị đăng nhập cùng tài khoản."
        >
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-surface-raised p-3">
              <dt className="text-xs text-muted-foreground">Kết nối</dt>
              <dd className={sync.online ? "font-medium text-gain" : "font-medium text-warning"}>
                {sync.online ? "Trực tuyến" : "Ngoại tuyến"}
              </dd>
            </div>
            <div className="rounded-lg bg-surface-raised p-3">
              <dt className="text-xs text-muted-foreground">Thời gian thực</dt>
              <dd className="font-medium">{sync.realtime ? "Đang bật" : "Đang kết nối…"}</dd>
            </div>
            <div className="rounded-lg bg-surface-raised p-3">
              <dt className="text-xs text-muted-foreground">Chờ đồng bộ</dt>
              <dd className="num font-medium">{sync.pending} thay đổi</dd>
            </div>
            <div className="rounded-lg bg-surface-raised p-3">
              <dt className="text-xs text-muted-foreground">Lần đồng bộ cuối</dt>
              <dd className="font-medium">
                {sync.lastSyncedAt ? formatDateTime(sync.lastSyncedAt) : "—"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Trên đám mây: {txs.data?.length ?? 0} giao dịch · {refs.data?.length ?? 0} danh mục tham
            khảo.
          </p>
          <Button
            variant="surface"
            className="mt-4"
            disabled={!sync.online || sync.syncing}
            onClick={() => void sync.syncNow()}
          >
            <RefreshCw className={sync.syncing ? "animate-spin" : ""} /> Đồng bộ ngay
          </Button>
        </Section>

        <LegacyMigration />
        <BackupSection />
        {provider === "email" && (
          <PasswordSection email={user.email ?? ""} isSynthetic={isSynthetic} />
        )}

        <Section
          icon={<LogOut className="h-4 w-4" />}
          title="Đăng xuất"
          description="Dữ liệu vẫn an toàn trên đám mây. Đăng nhập lại để tiếp tục trên bất kỳ thiết bị nào."
        >
          {sync.pending > 0 && (
            <p className="mb-3 text-sm text-warning">
              Còn {sync.pending} thay đổi chưa đồng bộ. Hãy kết nối mạng trước khi đăng xuất để
              không mất dữ liệu.
            </p>
          )}
          <Button variant="destructive" onClick={() => void signOut()}>
            <LogOut /> Đăng xuất
          </Button>
        </Section>
      </div>
    </div>
  );
}

/** Giao diện tối / trắng — bấm là đổi ngay, icon mặt trời/mặt trăng xoay và mờ dần vào nhau. */
function ThemeSection() {
  const [theme, setTheme] = useTheme();
  const isDark = theme === "dark";
  return (
    <Section
      icon={<SunMoon className="h-4 w-4" />}
      title="Giao diện"
      description="Chọn nền tối hoặc nền trắng cho toàn bộ app. Lựa chọn được lưu trên thiết bị này."
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={!isDark}
          aria-label={isDark ? "Đổi sang giao diện trắng" : "Đổi sang giao diện tối"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-raised transition-colors hover:border-primary/50"
        >
          <Sun
            aria-hidden
            className={cn(
              "absolute h-5 w-5 text-primary transition-all duration-500",
              isDark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0",
            )}
          />
          <Moon
            aria-hidden
            className={cn(
              "absolute h-5 w-5 text-primary transition-all duration-500",
              isDark ? "-rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100",
            )}
          />
        </button>
        <div>
          <div className="text-sm font-medium">{isDark ? "Tối" : "Trắng"}</div>
          <div className="text-xs text-muted-foreground">
            {isDark ? "Nền đen, dịu mắt ban đêm." : "Nền trắng, rõ ràng ban ngày."}
          </div>
        </div>
      </div>
    </Section>
  );
}

function BackupSection() {
  const user = useUser();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const txs = useTransactions();
  const refs = useReferences();
  const sync = useSync();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function onRestore(file: File) {
    setBusy(true);
    try {
      const backup = parseBackup(await file.text());
      const res = await restoreBackup(
        user.id,
        backup,
        new Set((txs.data ?? []).map((t) => t.id)),
        refs.data ?? [],
      );
      await qc.invalidateQueries({ queryKey: txKey(user.id) });
      await qc.invalidateQueries({ queryKey: refsKey(user.id) });
      await qc.invalidateQueries({ queryKey: profileKey(user.id) });
      toast.success(
        `Đã khôi phục ${res.txInserted} giao dịch và ${res.refsInserted} danh mục tham khảo. Bỏ qua ${res.txSkipped} giao dịch đã có.`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error && e.message.startsWith("Tệp")
          ? e.message
          : "Không khôi phục được dữ liệu từ tệp này.",
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <Section
      icon={<Download className="h-4 w-4" />}
      title="Sao lưu & khôi phục"
      description="Tải toàn bộ dữ liệu cá nhân về máy, hoặc khôi phục từ tệp sao lưu. Giao dịch trùng sẽ tự động được bỏ qua."
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant="surface"
          onClick={() =>
            downloadJson(
              `zero-to-hero-sao-luu-${todayKey()}.json`,
              buildBackup(profile, txs.data ?? [], refs.data ?? []),
            )
          }
        >
          <Download /> Xuất dữ liệu
        </Button>
        <Button variant="surface" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />} Khôi phục từ tệp
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && void onRestore(e.target.files[0])}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Ảnh chụp danh mục tham khảo không nằm trong tệp sao lưu; chúng được lưu riêng tư trên đám
        mây.
      </p>
    </Section>
  );
}

function LegacyMigration() {
  const user = useUser();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const txs = useTransactions();
  const refs = useReferences();
  const sync = useSync();
  const scan = useQuery({
    queryKey: ["legacy-scan"],
    queryFn: scanLegacyData,
    staleTime: Infinity,
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ expected: number; found: number } | null>(null);
  const records = scan.data ?? [];
  async function run() {
    setBusy(true);
    try {
      const res = await importLegacy(user.id, records);
      setResult(res);
      await qc.invalidateQueries({ queryKey: txKey(user.id) });
      if (res.found >= res.expected) {
        await updateProfile(user.id, { local_migrated_at: new Date().toISOString() });
        await qc.invalidateQueries({ queryKey: profileKey(user.id) });
        toast.success(`Đã chuyển và xác minh ${res.found}/${res.expected} giao dịch lên đám mây.`);
      } else {
        toast.warning(
          `Mới xác minh được ${res.found}/${res.expected} giao dịch. Dữ liệu cũ vẫn được giữ nguyên, bạn có thể thử lại.`,
        );
      }
    } catch {
      toast.error("Chuyển dữ liệu thất bại. Dữ liệu cũ trên trình duyệt vẫn được giữ nguyên.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section
      id="chuyen-du-lieu"
      icon={<CloudUpload className="h-4 w-4" />}
      title="Chuyển dữ liệu cũ lên đám mây"
      description="Quét bộ nhớ trình duyệt này để tìm giao dịch từ phiên bản cũ và đưa lên tài khoản của bạn. Dữ liệu gốc được giữ nguyên."
    >
      {scan.isLoading ? (
        <p className="text-sm text-muted-foreground">Đang quét…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Không tìm thấy dữ liệu cũ trên trình duyệt này.
          {profile?.local_migrated_at
            ? ` Đã chuyển lần cuối: ${formatDateTime(profile.local_migrated_at)}.`
            : ""}
        </p>
      ) : (
        <>
          <p className="text-sm">
            Tìm thấy <b className="num">{records.length}</b> giao dịch:
          </p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg bg-surface-raised p-3 text-xs">
            {records.slice(0, 50).map((r) => (
              <li key={r.importKey} className="num flex justify-between gap-2">
                <span>
                  {formatDate(r.tx_date)} · {formatNumber(r.quantity)} {displaySymbol(r.symbol)}
                </span>
                <span className="truncate text-muted-foreground">{r.source}</span>
              </li>
            ))}
          </ul>
          {result && (
            <p
              className={`mt-3 flex items-center gap-2 text-sm ${result.found >= result.expected ? "text-gain" : "text-warning"}`}
            >
              <CheckCircle2 className="h-4 w-4" /> Đã xác minh {result.found}/{result.expected} giao
              dịch trên đám mây.
            </p>
          )}
          <Button
            variant="hero"
            className="mt-4"
            disabled={busy || !sync.online}
            onClick={() => void run()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <CloudUpload />}{" "}
            {profile?.local_migrated_at ? "Chuyển lại (bỏ qua bản trùng)" : "Chuyển lên đám mây"}
          </Button>
        </>
      )}
      <Button
        variant="link"
        className="mt-1 h-auto px-0 text-xs"
        onClick={() => void scan.refetch()}
      >
        Quét lại
      </Button>
    </Section>
  );
}

function PasswordSection({ email, isSynthetic }: { email: string; isSynthetic: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    setBusy(true);
    try {
      if (isSynthetic) {
        // Tài khoản dùng tên đăng nhập không có email thật: xác minh mật
        // khẩu hiện tại bằng cách đăng nhập lại, rồi đổi thẳng mật khẩu.
        const verify = await supabase.auth.signInWithPassword({ email, password: current });
        if (verify.error) {
          toast.error("Mật khẩu hiện tại không đúng.");
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: next });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.updateUser({
          password: next,
          current_password: current,
        } as { password: string });
        if (error) throw error;
      }
      setCurrent("");
      setNext("");
      toast.success("Đã đổi mật khẩu.");
    } catch (err) {
      toast.error(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  }
  async function sendReset() {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(translateAuthError(error));
    else toast.success("Đã gửi email đặt lại mật khẩu.");
  }
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-raised text-primary">
          <KeyRound className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-semibold">Đổi mật khẩu</h2>
          <p className="text-sm text-muted-foreground">Bảo vệ tài khoản bằng mật khẩu mạnh.</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="cur">Mật khẩu hiện tại</Label>
          <Input
            id="cur"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new">Mật khẩu mới</Label>
          <Input
            id="new"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="surface" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Đổi mật khẩu
          </Button>
          {isSynthetic ? (
            <p className="text-xs text-muted-foreground">
              Tài khoản này không có email nên không đặt lại mật khẩu qua email được.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void sendReset()}
              className="text-xs text-primary hover:underline"
            >
              Quên mật khẩu hiện tại?
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

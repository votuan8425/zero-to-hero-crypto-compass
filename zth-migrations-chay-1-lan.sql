-- ============================================================
-- ZERO TO HERO — Chạy 1 lần trong Supabase SQL editor
-- (Dashboard → SQL Editor → New query → dán toàn bộ → Run)
-- Gồm migration 0002 + 0003 + 0004 + 0005 + 0007, theo đúng thứ tự.
-- An toàn chạy lại: các lệnh dùng IF NOT EXISTS nên chạy lại
-- cũng không lỗi (trừ CREATE TABLE đã đổi sang IF NOT EXISTS).
-- ============================================================

-- ---------- 0002: bảng admin_allocations (Tham khảo) ----------
CREATE TABLE IF NOT EXISTS public.admin_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  slices jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_allocations_user_idx ON public.admin_allocations (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_allocations TO authenticated;
GRANT ALL ON public.admin_allocations TO service_role;
ALTER TABLE public.admin_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin allocation select all" ON public.admin_allocations;
CREATE POLICY "admin allocation select all" ON public.admin_allocations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin allocation insert own" ON public.admin_allocations;
CREATE POLICY "admin allocation insert own" ON public.admin_allocations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'email') = 'yuntuan1309@gmail.com');

DROP POLICY IF EXISTS "admin allocation update own" ON public.admin_allocations;
CREATE POLICY "admin allocation update own" ON public.admin_allocations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'email') = 'yuntuan1309@gmail.com')
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'email') = 'yuntuan1309@gmail.com');

DROP POLICY IF EXISTS "admin allocation delete own" ON public.admin_allocations;
CREATE POLICY "admin allocation delete own" ON public.admin_allocations
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'email') = 'yuntuan1309@gmail.com');

DROP TRIGGER IF EXISTS admin_allocations_updated_at ON public.admin_allocations;
CREATE TRIGGER admin_allocations_updated_at BEFORE UPDATE ON public.admin_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 0003: cột stats (ngày bắt đầu + lãi/lỗ %) ----------
ALTER TABLE public.admin_allocations ADD COLUMN IF NOT EXISTS started_at date;
ALTER TABLE public.admin_allocations ADD COLUMN IF NOT EXISTS pnl_pct numeric;

-- ---------- 0004: tiền tệ USDT/KRW (sửa lỗi không lưu được hồ sơ) ----------
-- THỨ TỰ QUAN TRỌNG: phải DROP CHECK cũ TRƯỚC khi UPDATE, vì CHECK cũ chỉ
-- cho VND/USD — UPDATE USD→USDT mà chạy trước sẽ bị CHECK cũ chặn lại.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_currency_check;
UPDATE public.profiles SET currency = 'USDT' WHERE currency = 'USD';
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_currency_check CHECK (currency IN ('VND', 'USDT', 'KRW'));

-- ---------- 0005: cột lời nhắn ----------
ALTER TABLE public.admin_allocations ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.admin_allocations ADD COLUMN IF NOT EXISTS message_updated_at timestamptz;
-- 0007: Thông báo trong app + Web Push (theo dõi admin)
-- Khi admin đăng/cập nhật danh mục hoặc lời nhắn -> tạo thông báo cho các
-- follower đã được duyệt. Khi admin duyệt yêu cầu theo dõi -> báo cho follower.
-- Web Push: trình duyệt đăng ký nhận push, lưu vào push_subscriptions; job
-- /api/public/jobs/send-push gửi push cho các thông báo chưa gửi.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  investor_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('allocation_updated', 'admin_message', 'follow_approved', 'follow_requested')),
  title text NOT NULL,
  body text NOT NULL,
  link text NOT NULL DEFAULT '/tham-khao',
  read_at timestamptz NULL,
  push_sent_at timestamptz NULL,
  push_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_pending_push_idx
  ON public.notifications (created_at) WHERE push_sent_at IS NULL;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Người dùng chỉ đọc và đánh dấu đã đọc thông báo của chính mình.
-- Không có policy INSERT/DELETE cho client: chỉ trigger (SECURITY DEFINER)
-- và service_role được ghi.
DROP POLICY IF EXISTS "notifications select own" ON public.notifications;
CREATE POLICY "notifications select own" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications update own read" ON public.notifications;
CREATE POLICY "notifications update own read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions own all" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions own all" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.notifications, public.push_subscriptions TO service_role;

-- Trigger: admin đăng/cập nhật danh mục -> báo cho follower đã duyệt.
-- Gộp: follower đã có thông báo chưa đọc cùng loại trong 10 phút thì cập
-- nhật lại thông báo đó (đẩy lại push) thay vì tạo thông báo mới.
CREATE OR REPLACE FUNCTION public.notify_followers_on_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_name text;
  changed_kind text;
  n_title text;
  n_body text;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.slices IS NOT DISTINCT FROM OLD.slices
    AND NEW.message IS NOT DISTINCT FROM OLD.message THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(display_name, ''), 'Admin') INTO admin_name
  FROM public.profiles WHERE id = NEW.user_id;
  admin_name := COALESCE(admin_name, 'Admin');

  IF TG_OP = 'UPDATE' AND NEW.slices IS NOT DISTINCT FROM OLD.slices THEN
    changed_kind := 'admin_message';
    n_title := admin_name || ' đã cập nhật lời nhắn';
    n_body := COALESCE(NULLIF(NEW.message, ''), 'Admin vừa cập nhật lời nhắn mới.');
  ELSE
    changed_kind := 'allocation_updated';
    n_title := admin_name || ' đã cập nhật danh mục';
    n_body := 'Danh mục tham khảo của ' || admin_name || ' vừa thay đổi — mở Tham khảo để xem.';
  END IF;

  UPDATE public.notifications n
  SET title = n_title, body = n_body, created_at = now(),
      push_sent_at = NULL, push_attempts = 0
  FROM public.investor_follows f
  WHERE n.user_id = f.follower_id
    AND n.investor_id = NEW.user_id
    AND n.type = changed_kind
    AND n.read_at IS NULL
    AND n.created_at > now() - interval '10 minutes'
    AND f.investor_id = NEW.user_id
    AND f.status = 'approved';

  INSERT INTO public.notifications (user_id, investor_id, type, title, body, link)
  SELECT f.follower_id, NEW.user_id, changed_kind, n_title, n_body, '/tham-khao'
  FROM public.investor_follows f
  WHERE f.investor_id = NEW.user_id
    AND f.status = 'approved'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = f.follower_id
        AND n.investor_id = NEW.user_id
        AND n.type = changed_kind
        AND n.read_at IS NULL
        AND n.created_at > now() - interval '10 minutes'
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_followers_on_allocation ON public.admin_allocations;
CREATE TRIGGER trg_notify_followers_on_allocation
AFTER INSERT OR UPDATE ON public.admin_allocations
FOR EACH ROW EXECUTE FUNCTION public.notify_followers_on_allocation();

-- Trigger: có người xin theo dõi -> báo cho admin; admin duyệt -> báo cho follower.
CREATE OR REPLACE FUNCTION public.notify_on_follow_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_name text;
  follower_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(NULLIF(display_name, ''), 'Người dùng') INTO follower_name
    FROM public.profiles WHERE id = NEW.follower_id;
    follower_name := COALESCE(follower_name, 'Người dùng');
    INSERT INTO public.notifications (user_id, investor_id, type, title, body, link)
    VALUES (NEW.investor_id, NEW.investor_id, 'follow_requested',
            follower_name || ' xin theo dõi bạn',
            follower_name || ' vừa gửi yêu cầu theo dõi danh mục của bạn.',
            '/tham-khao');
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'approved' THEN
    SELECT COALESCE(NULLIF(display_name, ''), 'Admin') INTO admin_name
    FROM public.profiles WHERE id = NEW.investor_id;
    admin_name := COALESCE(admin_name, 'Admin');
    INSERT INTO public.notifications (user_id, investor_id, type, title, body, link)
    VALUES (NEW.follower_id, NEW.investor_id, 'follow_approved',
            admin_name || ' đã duyệt bạn',
            admin_name || ' đã duyệt yêu cầu theo dõi — giờ bạn xem được biểu đồ danh mục.',
            '/tham-khao');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_follow_change ON public.investor_follows;
CREATE TRIGGER trg_notify_on_follow_change
AFTER INSERT OR UPDATE OF status ON public.investor_follows
FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow_change();

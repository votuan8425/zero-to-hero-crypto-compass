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

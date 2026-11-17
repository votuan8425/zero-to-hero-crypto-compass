-- Admin allocation (Tham khảo): one row per admin, percent-only.
-- Apply in the Supabase SQL editor (or via Lovable) before this feature
-- works; until then the frontend shows "Admin chưa công bố danh mục".
-- Slices hold ONLY {symbol, name, percent} — never quantity, value,
-- invested amounts, dates, notes or images.

CREATE TABLE public.admin_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  slices jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_allocations_user_idx ON public.admin_allocations (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_allocations TO authenticated;
GRANT ALL ON public.admin_allocations TO service_role;
ALTER TABLE public.admin_allocations ENABLE ROW LEVEL SECURITY;

-- Every logged-in user can read the admin allocation.
CREATE POLICY "admin allocation select all" ON public.admin_allocations
  FOR SELECT TO authenticated USING (true);

-- Only the admin (yuntuan1309@gmail.com) can write, and only their own row.
CREATE POLICY "admin allocation insert own" ON public.admin_allocations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'email') = 'yuntuan1309@gmail.com');
CREATE POLICY "admin allocation update own" ON public.admin_allocations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'email') = 'yuntuan1309@gmail.com')
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'email') = 'yuntuan1309@gmail.com');
CREATE POLICY "admin allocation delete own" ON public.admin_allocations
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'email') = 'yuntuan1309@gmail.com');

CREATE TRIGGER admin_allocations_updated_at BEFORE UPDATE ON public.admin_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_allocations;

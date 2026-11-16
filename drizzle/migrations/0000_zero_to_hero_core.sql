CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  currency text NOT NULL DEFAULT 'VND' CHECK (currency IN ('VND','USD')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  local_migrated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  symbol text NOT NULL,
  coin_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  price_usd numeric NOT NULL CHECK (price_usd >= 0),
  fee_usd numeric NOT NULL DEFAULT 0 CHECK (fee_usd >= 0),
  tx_date date NOT NULL DEFAULT current_date,
  note text,
  import_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, import_key)
);
CREATE INDEX transactions_user_date_idx ON public.transactions (user_id, tx_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx select" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own tx insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tx update" ON public.transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tx delete" ON public.transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REFERENCE PORTFOLIOS
CREATE TABLE public.reference_portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  description text,
  notes text,
  image_paths text[] NOT NULL DEFAULT '{}',
  holdings jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_value numeric,
  total_value_currency text,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reference_portfolios_user_idx ON public.reference_portfolios (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_portfolios TO authenticated;
GRANT ALL ON public.reference_portfolios TO service_role;
ALTER TABLE public.reference_portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ref select" ON public.reference_portfolios FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own ref insert" ON public.reference_portfolios FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ref update" ON public.reference_portfolios FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ref delete" ON public.reference_portfolios FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER reference_portfolios_updated_at BEFORE UPDATE ON public.reference_portfolios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reference_portfolios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
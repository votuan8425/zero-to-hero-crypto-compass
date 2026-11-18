ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS price_vnd numeric NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS fee_vnd numeric NULL;
COMMENT ON COLUMN public.transactions.price_vnd IS 'Exact purchase price in VND per unit (set for gold/silver, which are always priced in VND)';

CREATE TABLE public.metal_prices (
  symbol text NOT NULL,
  slot_at timestamptz NOT NULL,
  bid_vnd numeric NOT NULL CHECK (bid_vnd > 0),
  ask_vnd numeric NOT NULL CHECK (ask_vnd > 0),
  source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, slot_at)
);

GRANT SELECT ON public.metal_prices TO anon, authenticated;
GRANT ALL ON public.metal_prices TO service_role;

ALTER TABLE public.metal_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published gold and silver prices"
ON public.metal_prices FOR SELECT
TO anon, authenticated
USING (true);
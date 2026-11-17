-- Admin allocation stats (Tham khảo deploy): when the admin publishes
-- their portfolio, store the accumulation start date and the current
-- P/L % vs invested capital. Both are public, percent/date-only values —
-- NEVER money amounts, quantities or invested sums.
-- Apply in the Supabase SQL editor (or via Lovable). Until it is applied,
-- the frontend keeps working: it reads/writes the slices only and the
-- stats simply show as unavailable.

ALTER TABLE public.admin_allocations ADD COLUMN IF NOT EXISTS started_at date;
ALTER TABLE public.admin_allocations ADD COLUMN IF NOT EXISTS pnl_pct numeric;

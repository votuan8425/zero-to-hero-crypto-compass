ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_quantity_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_quantity_check CHECK (quantity <> 0);
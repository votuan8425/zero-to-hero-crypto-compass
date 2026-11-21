-- Cho phép giao dịch BÁN (số lượng âm) trong bảng transactions.
--
-- Vấn đề: bảng transactions có ràng buộc CHECK (quantity > 0) từ migration
-- gốc 0000. App lưu giao dịch bán bằng quantity ÂM (mua = dương, bán = âm)
-- nên mọi lệnh bán — gồm cả chân bán của Swap ("Chuyển đổi") và sửa giao
-- dịch bán trong dialog mua/bán — đều bị database từ chối, app báo
-- "Không lưu được giao dịch đổi. Vui lòng thử lại."
-- (Người dùng gặp khi đổi 0,3 ETH sang USDT ngày 21/11/2026.)
--
-- Sửa: đổi ràng buộc thành quantity <> 0 — vẫn cấm giao dịch số lượng 0
-- (vô nghĩa) nhưng cho phép cả mua (dương) và bán (âm).
-- Chạy trong Lovable (SQL editor hoặc nhờ Lovable chat chạy file này).
-- Không cần sửa code app: app đã lưu bán bằng số âm từ đầu.

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_quantity_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_quantity_check CHECK (quantity <> 0);

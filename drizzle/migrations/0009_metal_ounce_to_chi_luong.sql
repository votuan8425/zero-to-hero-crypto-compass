-- 0009: Giao dịch vàng/bạc cũ lưu theo ounce (bản dialog trước vòng 6)
-- đổi sang đơn vị trong nước: vàng theo chỉ, bạc theo lượng.
--
-- CHỈ CHẠY 1 LẦN — không chạy lại, không gộp vào file
-- zth-migrations-chay-1-lan.sql (file đó được thiết kế để chạy lại).
--
-- Nhận diện dòng cũ: dialog cũ lưu giá USD mỗi ounce và không có giá VND
-- chính xác (price_vnd IS NULL); dialog mới luôn lưu price_vnd nên các
-- dòng mới không bao giờ khớp điều kiện này.
--   Vàng: giá ounce lúc đó ~3.700 USDT (> 1.500); sau khi đổi, giá mỗi chỉ
--         còn ~450 USDT nên chạy lại cũng không khớp nữa.
--   Bạc: giá ounce lúc đó ~50 USDT (47–57); sau khi đổi, giá mỗi lượng
--        ~60 USDT nên chạy lại cũng không khớp nữa.
-- Phí (fee_usd/fee_vnd) là tổng tiền nên giữ nguyên, không đổi.
-- 1 ounce troy = 31,1034768 g; 1 chỉ = 3,75 g; 1 lượng = 37,5 g.

UPDATE public.transactions
SET quantity = quantity * (31.1034768 / 3.75),
    price_usd = price_usd / (31.1034768 / 3.75)
WHERE symbol = 'PAXG' AND price_vnd IS NULL AND price_usd > 1500;

UPDATE public.transactions
SET quantity = quantity * (31.1034768 / 37.5),
    price_usd = price_usd / (31.1034768 / 37.5)
WHERE symbol = 'KAG' AND price_vnd IS NULL AND price_usd > 47 AND price_usd < 57;

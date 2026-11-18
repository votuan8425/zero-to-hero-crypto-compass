import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Lịch chạy lúc 06:00 và 22:00 giờ Việt Nam: lưu giá vàng SJC và bạc Ancarat cho mốc đó. */
export const Route = createFileRoute("/api/public/jobs/metal-prices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { recordMetalPrices } = await import("@/lib/metal-prices.server");
        const { metalSlotAt } = await import("@/lib/metals");
        // Lịch có thể chạy trễ vài chục giây; mốc tính theo giờ hiện tại.
        const result = await recordMetalPrices(metalSlotAt(new Date()));
        return Response.json({ success: true, ...result });
      },
    },
  },
});

import { describe, expect, it } from "vitest";
import { shouldShowSoftAsk, urlBase64ToUint8Array } from "@/lib/push";
import { buildPushPayload } from "@/lib/push.server";

// Khóa VAPID public thật đã tạo cho app (khóa công khai, an toàn để lộ).
const VAPID_PUBLIC_KEY =
  "BND_dBN6kmjSiz5ukZr628cW5NHU_qKjDevVc3EQeRX5EA9hlrjrtzSBhW0K7bl3sT8y9fLck7o6V3vUsvcN2MA";

describe("urlBase64ToUint8Array (khóa VAPID)", () => {
  it("giải mã base64url có ký tự - và _", () => {
    // "hi" -> aGk (thiếu padding, vẫn giải mã được)
    expect(Array.from(urlBase64ToUint8Array("aGk"))).toEqual([104, 105]);
  });

  it("khóa VAPID public giải mã ra đúng 65 byte (khóa P-256)", () => {
    expect(urlBase64ToUint8Array(VAPID_PUBLIC_KEY).length).toBe(65);
    expect(urlBase64ToUint8Array(VAPID_PUBLIC_KEY)[0]).toBe(4);
  });
});

describe("shouldShowSoftAsk (hỏi mềm bật push)", () => {
  const base = {
    permission: "default" as const,
    askedCount: 0,
    lastAskedAt: null as number | null,
    now: Date.now(),
  };

  it("chưa hỏi lần nào thì hiện", () => {
    expect(shouldShowSoftAsk(base)).toBe(true);
  });

  it("đã cho phép / đã chặn thì không hiện lại", () => {
    expect(shouldShowSoftAsk({ ...base, permission: "granted" })).toBe(false);
    expect(shouldShowSoftAsk({ ...base, permission: "denied" })).toBe(false);
  });

  it("đã hỏi 2 lần thì thôi, không làm phiền nữa", () => {
    expect(shouldShowSoftAsk({ ...base, askedCount: 2 })).toBe(false);
    expect(shouldShowSoftAsk({ ...base, askedCount: 1 })).toBe(true);
  });

  it("mới hỏi trong 24h thì chưa hỏi lại", () => {
    expect(
      shouldShowSoftAsk({ ...base, askedCount: 1, lastAskedAt: base.now - 60_000 }),
    ).toBe(false);
    expect(
      shouldShowSoftAsk({
        ...base,
        askedCount: 1,
        lastAskedAt: base.now - 25 * 3600 * 1000,
      }),
    ).toBe(true);
  });
});

describe("buildPushPayload (nội dung push gửi đi)", () => {
  it("đủ title/body/url/tag, tag mang id thông báo để chống trùng", () => {
    const json = buildPushPayload({
      id: "abc-123",
      title: "Admin đã cập nhật danh mục",
      body: "Danh mục tham khảo vừa thay đổi — mở Tham khảo để xem.",
      link: "/tham-khao",
    });
    const payload = JSON.parse(json) as Record<string, unknown>;
    expect(payload).toEqual({
      title: "Admin đã cập nhật danh mục",
      body: "Danh mục tham khảo vừa thay đổi — mở Tham khảo để xem.",
      url: "/tham-khao",
      tag: "zth-abc-123",
    });
  });

  it("không có link thì về mặc định /tham-khao", () => {
    const payload = JSON.parse(
      buildPushPayload({ id: "x", title: "T", body: "B", link: null }),
    ) as Record<string, unknown>;
    expect(payload["url"]).toBe("/tham-khao");
  });
});

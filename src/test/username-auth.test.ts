import { describe, expect, it } from "vitest";
import { ADMIN_EMAIL, ADMIN_USERNAME, SYNTH_DOMAIN, isAdminUser } from "@/lib/admin";
import {
  authEmailToUsername,
  isSyntheticAuthEmail,
  normalizeUsername,
  usernameToAuthEmail,
  validateUsername,
} from "@/lib/username-auth";

describe("username normalisation & validation", () => {
  it("lowercases and trims", () => {
    expect(normalizeUsername("  MinhTuan ")).toBe("minhtuan");
  });
  it("accepts a plain username", () => {
    expect(validateUsername("minhtuan")).toBeNull();
    expect(validateUsername("tuan_09")).toBeNull();
    expect(validateUsername("a.b-c")).toBeNull();
  });
  it("rejects too short, too long, spaces and @", () => {
    expect(validateUsername("ab")).toBeTruthy();
    expect(validateUsername("a".repeat(21))).toBeTruthy();
    expect(validateUsername("minh tuan")).toBeTruthy();
    expect(validateUsername("a@b")).toBeTruthy();
    expect(validateUsername("")).toBeTruthy();
  });
});

describe("username -> auth email mapping", () => {
  it("maps the admin username to the admin Gmail (same account)", () => {
    expect(usernameToAuthEmail("yuntuan1309")).toBe(ADMIN_EMAIL);
    expect(usernameToAuthEmail("YunTuan1309")).toBe(ADMIN_EMAIL);
  });
  it("maps a plain username to a synthetic address on the app domain", () => {
    expect(usernameToAuthEmail("minhtuan")).toBe(`minhtuan@${SYNTH_DOMAIN}`);
    expect(usernameToAuthEmail("  MinhTuan ")).toBe(`minhtuan@${SYNTH_DOMAIN}`);
  });
  it("passes real emails through unchanged", () => {
    expect(usernameToAuthEmail("ban@email.com")).toBe("ban@email.com");
    expect(usernameToAuthEmail(ADMIN_EMAIL)).toBe(ADMIN_EMAIL);
  });
  it("detects synthetic addresses and recovers the username", () => {
    expect(isSyntheticAuthEmail(`minhtuan@${SYNTH_DOMAIN}`)).toBe(true);
    expect(isSyntheticAuthEmail("ban@email.com")).toBe(false);
    expect(isSyntheticAuthEmail(null)).toBe(false);
    expect(authEmailToUsername(`minhtuan@${SYNTH_DOMAIN}`)).toBe("minhtuan");
    expect(authEmailToUsername("ban@email.com")).toBe("ban");
    expect(authEmailToUsername(null)).toBe("");
  });
});

describe("isAdminUser", () => {
  it("matches by admin email", () => {
    expect(isAdminUser({ email: ADMIN_EMAIL, user_metadata: {} })).toBe(true);
    expect(isAdminUser({ email: "YunTuan1309@Gmail.com", user_metadata: {} })).toBe(true);
  });
  it("matches by stored admin username", () => {
    expect(
      isAdminUser({
        email: `yuntuan1309@${SYNTH_DOMAIN}`,
        user_metadata: { username: ADMIN_USERNAME },
      }),
    ).toBe(true);
  });
  it("rejects normal users and empty input", () => {
    expect(
      isAdminUser({
        email: `minhtuan@${SYNTH_DOMAIN}`,
        user_metadata: { username: "minhtuan" },
      }),
    ).toBe(false);
    expect(isAdminUser({ email: "ban@email.com", user_metadata: {} })).toBe(false);
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
  });
});

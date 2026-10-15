import { describe, expect, it } from "vitest";
import { canChangePassword, canModerate, canPromote } from "@/lib/account-permissions";
describe("account permissions", () => {
  it("lets users change their own passwords", () => { expect(canChangePassword(null, "user", "user")).toBe(true); expect(canChangePassword(null, "user", "other")).toBe(false); });
  it("prevents mods changing someone else's password", () => { expect(canChangePassword("mod", "mod", "other")).toBe(false); });
  it("lets the owner change another password", () => { expect(canChangePassword("owner", "achulate", "other")).toBe(true); });
  it("only lets the owner promote mods", () => { expect(canPromote("mod")).toBe(false); expect(canPromote("owner")).toBe(true); });
  it("allows mods to moderate but not ordinary users", () => { expect(canModerate("mod")).toBe(true); expect(canModerate(null)).toBe(false); });
});
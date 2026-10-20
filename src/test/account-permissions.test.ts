import { describe, expect, it } from "vitest";
import { canBan, canChangePassword, canDeleteAccounts, canModerate, canPromote, canCreatePublicRoom, canRevokeTabs, canViewAccountHistory, canManageAccount, REVOCABLE_TABS } from "@/lib/account-permissions";
describe("account permissions", () => {
  it("lets only the owner view other people's history", () => {
    for (const target of [null, "mod", "admin"] as const) expect(canViewAccountHistory("owner", target)).toBe(true);
    expect(canViewAccountHistory("owner", "owner")).toBe(false);
    for (const caller of [null, "mod", "admin"] as const) for (const target of [null, "mod", "admin", "owner"] as const) expect(canViewAccountHistory(caller, target)).toBe(false);
  });
  it("lets only the owner delete accounts", () => { expect(canDeleteAccounts("owner")).toBe(true); expect(canDeleteAccounts("admin")).toBe(false); expect(canDeleteAccounts("mod")).toBe(false); expect(canDeleteAccounts(null)).toBe(false); });
  it("prevents every other rank from altering an owner account", () => { for (const role of [null, "mod", "admin", "owner"] as const) expect(canManageAccount(role, "owner")).toBe(false); });
  it("lets users change their own passwords", () => { expect(canChangePassword(null, "user", "user")).toBe(true); expect(canChangePassword(null, "user", "other")).toBe(false); });
  it("prevents mods changing someone else's password", () => { expect(canChangePassword("mod", "mod", "other")).toBe(false); });
  it("lets the owner change another password", () => { expect(canChangePassword("owner", "achulate", "other")).toBe(true); });
  it("only lets the owner promote mods", () => { expect(canPromote("mod")).toBe(false); expect(canPromote("owner")).toBe(true); });
  it("allows mods to moderate but not ordinary users", () => { expect(canModerate("mod")).toBe(true); expect(canModerate(null)).toBe(false); });
  it("restricts public chat creation to mods, admins and owner", () => { expect(canCreatePublicRoom(null)).toBe(false); for (const role of ["mod", "admin", "owner"] as const) expect(canCreatePublicRoom(role)).toBe(true); });
  it("supports revoking all four requested menus", () => { expect([...REVOCABLE_TABS].sort()).toEqual(["browser", "chat", "music", "youtube"]); });
  it("lets mods, admins and owner revoke menus", () => { expect(canRevokeTabs(null)).toBe(false); expect(canRevokeTabs("mod")).toBe(true); expect(canRevokeTabs("admin")).toBe(true); expect(canRevokeTabs("owner")).toBe(true); });
  it("lets admins and owner ban but not mods", () => { expect(canBan(null)).toBe(false); expect(canBan("mod")).toBe(false); expect(canBan("admin")).toBe(true); expect(canBan("owner")).toBe(true); });
});
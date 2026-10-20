import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConsoleTab } from "@/components/console-tab";
import { ownerSetExtras } from "@/lib/extras.functions";

vi.mock("@/lib/account", () => ({ useAccount: () => ({ user: { id: "owner", role: "owner" } }) }));
vi.mock("@/components/profile", () => ({ Avatar: () => null, ProfileDialog: () => null }));
vi.mock("@/components/password-settings", () => ({ PasswordSettings: () => null }));
vi.mock("@/lib/extras.functions", () => ({ ownerGetExtras: vi.fn().mockResolvedValue({ chatRank: null, klebEnabled: false }), ownerSetExtras: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/account.functions", () => ({
  adminListUsers: vi.fn().mockResolvedValue([{ id: "member", username: "TestMember", role: null, banned: false, avatar: null, last_seen: "2026-10-20T00:00:00Z" }]),
  adminGetUser: vi.fn().mockResolvedValue({ user: { id: "member", username: "TestMember", role: null, blockedTabs: [], createdAt: "2026-10-20T00:00:00Z", lastSeen: "2026-10-20T00:00:00Z" }, activity: [], canViewLogs: false }),
  adminDeleteUser: vi.fn(), adminSetMod: vi.fn(), adminSetBan: vi.fn(), adminSetBlockedTabs: vi.fn(),
}));

describe("Console rank assignment", () => {
  it("saves a VIP assignment through the combined Rank menu", async () => {
    render(<ConsoleTab visible={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "TestMember Member" }));
    const trigger = await screen.findByRole("button", { name: "Rank" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const vip = await screen.findByRole("menuitemradio", { name: /VIP/ });
    fireEvent.click(vip);
    await waitFor(() => expect(ownerSetExtras).toHaveBeenCalledWith({ data: { id: "member", chatRank: "vip" } }));
  });
});
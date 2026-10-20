export type AccountRole = "owner" | "contributor" | "admin" | "mod" | null;
/** Mods, admins, contributors and the owner can moderate chat. */
export function canModerate(role: AccountRole) { return roleRank(role) >= 1; }
/** Only the owner can delete accounts. */
export function canDeleteAccounts(role: AccountRole) { return role === "owner"; }
export function canChangePassword(role: AccountRole, callerId: string, targetId: string) { return callerId === targetId || role === "owner"; }
export function canPromote(role: AccountRole) { return role === "owner"; }
/** Contributors, admins and the owner can ban accounts; mods cannot. */
export function canBan(role: AccountRole) { return roleRank(role) >= 2; }
/** Only the owner can view account history, never another owner's. */
export function canViewAccountHistory(caller: AccountRole, target: AccountRole) {
  return caller === "owner" && target !== "owner";
}
export function canManageAccount(caller: AccountRole, target: AccountRole) {
  return target !== "owner" && roleRank(caller) > roleRank(target);
}
export function canToggleSafeSearch(role: AccountRole) { return roleRank(role) >= 2; }
/** Mods, admins, contributors and the owner can revoke tab access. */
export function canRevokeTabs(role: AccountRole) { return canModerate(role); }
export function canCreatePublicRoom(role: AccountRole) { return canModerate(role); }
export const REVOCABLE_TABS = ["browser", "youtube", "chat", "music"] as const;
/** Rank order: owner > contributor > admin > mod > member. */
export const roleRank = (role: AccountRole) => (role === "owner" ? 4 : role === "contributor" ? 3 : role === "admin" ? 2 : role === "mod" ? 1 : 0);

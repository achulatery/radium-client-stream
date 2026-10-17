export type AccountRole = "owner" | "admin" | "mod" | null;
/** Mods, admins and the owner can moderate chat and ban users. */
export function canModerate(role: AccountRole) { return role === "owner" || role === "admin" || role === "mod"; }
/** Only admins and the owner can delete accounts. */
export function canDeleteAccounts(role: AccountRole) { return role === "owner" || role === "admin"; }
export function canChangePassword(role: AccountRole, callerId: string, targetId: string) { return callerId === targetId || role === "owner"; }
export function canPromote(role: AccountRole) { return role === "owner"; }
/** Owner and admins can view user history. */
export function canViewLogs(role: AccountRole) { return role === "owner" || role === "admin"; }
export function canViewAccountHistory(caller: AccountRole, target: AccountRole) {
  return caller === "owner" || (caller === "admin" && target !== "owner");
}
export function canManageAccount(caller: AccountRole, target: AccountRole) {
  return target !== "owner" && roleRank(caller) > roleRank(target);
}
export function canToggleSafeSearch(role: AccountRole) { return role === "owner" || role === "admin"; }
/** Admins and the owner can revoke tab access. */
export function canRevokeTabs(role: AccountRole) { return role === "owner" || role === "admin"; }
export function canCreatePublicRoom(role: AccountRole) { return canModerate(role); }
export const REVOCABLE_TABS = ["browser", "youtube", "chat", "music"] as const;
export const roleRank = (role: AccountRole) => (role === "owner" ? 3 : role === "admin" ? 2 : role === "mod" ? 1 : 0);

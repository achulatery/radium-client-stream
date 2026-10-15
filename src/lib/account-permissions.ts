export type AccountRole = "owner" | "admin" | "mod" | null;
/** Mods, admins and the owner can moderate chat and ban users. */
export function canModerate(role: AccountRole) { return role === "owner" || role === "admin" || role === "mod"; }
/** Only admins and the owner can delete accounts. */
export function canDeleteAccounts(role: AccountRole) { return role === "owner" || role === "admin"; }
export function canChangePassword(role: AccountRole, callerId: string, targetId: string) { return callerId === targetId || role === "owner"; }
export function canPromote(role: AccountRole) { return role === "owner"; }
export function canViewLogs(role: AccountRole) { return role === "owner"; }
export const roleRank = (role: AccountRole) => (role === "owner" ? 3 : role === "admin" ? 2 : role === "mod" ? 1 : 0);

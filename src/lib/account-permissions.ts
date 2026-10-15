export type AccountRole = "owner" | "mod" | null;
export function canModerate(role: AccountRole) { return role === "owner" || role === "mod"; }
export function canChangePassword(role: AccountRole, callerId: string, targetId: string) { return callerId === targetId || role === "owner"; }
export function canPromote(role: AccountRole) { return role === "owner"; }
import type { AccountRole } from "./account-permissions";
export const CHAT_RANKS = ["vip", "mvp", "mythic", "legend", "radium"] as const;
export type ChatRank = typeof CHAT_RANKS[number] | null;
export const CHUNK_BYTES = 8_000_000;
export const KLEB_BYTES = 5_000_000_000;
export function attachmentLimit(role: AccountRole, rank: ChatRank) {
  if (role === "owner" || role === "admin") return 15_000_000_000;
  const ranked = rank === "radium" ? 5_000_000_000 : rank === "legend" ? 1_000_000_000 : rank === "mvp" || rank === "mythic" ? 500_000_000 : rank === "vip" ? 30_000_000 : 10_000_000;
  return Math.max(role === "mod" ? 30_000_000 : 0, ranked);
}
export const canAssignChatRank = (role: AccountRole) => role === "owner";
export const canUseKleb = (role: AccountRole, granted: boolean) => role === "owner" || granted;
export const formatBytes = (bytes: number) => bytes >= 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(1).replace(/\.0$/, "")} GB` : `${(bytes / 1_000_000).toFixed(1).replace(/\.0$/, "")} MB`;
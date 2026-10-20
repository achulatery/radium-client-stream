import type { AccountRole } from "./account-permissions";
export const CHAT_RANKS = ["vip", "mvp", "mythic", "legend", "radium", "contributor"] as const;
export type ChatRank = typeof CHAT_RANKS[number] | null;
export const CHUNK_BYTES = 8_000_000;
export const KLEB_BYTES = 5_000_000_000;
/** Per-message media allowance. RADIUM, admins and the owner are unlimited. */
export const UNLIMITED_BYTES = Number.MAX_SAFE_INTEGER;
export const RANK_LIMITS = { vip: 15_000_000, mvp: 300_000_000, mythic: 3_000_000_000, legend: 10_000_000_000 } as const;
export function attachmentLimit(role: AccountRole, rank: ChatRank) {
  if (role === "owner" || role === "admin" || rank === "radium") return UNLIMITED_BYTES;
  // Tag-only ranks (contributor) carry no extra allowance and keep the member limit.
  return (rank && rank in RANK_LIMITS ? RANK_LIMITS[rank as keyof typeof RANK_LIMITS] : undefined) ?? 10_000_000;
}
export const canAssignChatRank = (role: AccountRole) => role === "owner";
export const canUseKleb = (role: AccountRole, granted: boolean) => role === "owner" || granted;
export const formatBytes = (bytes: number) => bytes >= UNLIMITED_BYTES ? "Unlimited" : bytes >= 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(1).replace(/\.0$/, "")} GB` : `${(bytes / 1_000_000).toFixed(1).replace(/\.0$/, "")} MB`;
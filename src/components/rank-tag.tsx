import type { CSSProperties } from "react";
import type { ChatRank } from "@/lib/chat-ranks";

/** Neon chat rank tag. RADIUM glows in the author's own accent colour. */
export function RankTag({ rank, accent }: { rank: ChatRank; accent?: string | null }) {
  if (!rank) return null;
  const style = rank === "radium" && accent ? ({ "--rank-color": accent } as CSSProperties) : undefined;
  return <span className={`rd-rank rd-rank-${rank}`} style={style}>{rank.toUpperCase()}</span>;
}

/** Owner and admin tags share the staff neon red; contributor glows orange. */
export function StaffTag({ role }: { role: string | null | undefined }) {
  if (role === "contributor") return <span className="rd-rank rd-rank-contributor">CONTRIBUTOR</span>;
  if (role !== "owner" && role !== "admin") return null;
  return <span className="rd-rank rd-rank-staff">{role.toUpperCase()}</span>;
}

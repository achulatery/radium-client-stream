import type { ChatRank } from "@/lib/chat-ranks";
export function RankTag({ rank }: { rank: ChatRank }) {
  return rank ? <span className={`rd-rank rd-rank-${rank}`}>{rank.toUpperCase()}</span> : null;
}
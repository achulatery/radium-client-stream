import { db, requireUser } from "./account-session.server";
import { canModerate } from "./account-permissions";
import { CHUNK_BYTES } from "./chat-ranks";
export async function uploadContext(kind: "chat" | "kleb", roomId?: string) {
  const user = await requireUser(); const sb = await db();
  if (kind === "kleb") {
    const { data } = await sb.from("app_extras").select("kleb_enabled").eq("user_id", user.id).maybeSingle();
    if (user.role !== "owner" && !data?.kleb_enabled) throw new Error("Kleb access has not been granted");
  } else {
    if ((user.blocked_tabs ?? []).includes("chat")) throw new Error("Chat access has been revoked");
    if (!roomId) throw new Error("Choose a chat room");
    const { data: room } = await sb.from("app_chat_rooms").select("code,is_public").eq("id", roomId).maybeSingle();
    if (!room) throw new Error("Room not found");
    const { data: membership } = await sb.from("app_room_members").select("room_id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
    if (!room.is_public && room.code !== "general" && !membership && !canModerate(user.role)) throw new Error("Join this room first");
  }
  return { user, sb };
}
export async function ownedUpload(id: string) {
  const user = await requireUser(); const sb = await db();
  const { data: row } = await sb.from("app_uploads").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!row) throw new Error("Upload not found");
  await uploadContext(row.kind as "chat" | "kleb", row.room_id ?? undefined);
  return { user, sb, row };
}
export async function verifyChunks(sb: Awaited<ReturnType<typeof db>>, row: { user_id: string; id: string; chunk_count: number; size_bytes: number }) {
  for (let offset = 0; offset < row.chunk_count; offset += 100) {
    const { data: files, error } = await sb.storage.from("radium-files").list(`${row.user_id}/${row.id}`, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    const count = Math.min(100, row.chunk_count - offset);
    if (error || files?.length !== count) throw new Error("Upload is incomplete");
    for (let n = 0; n < count; n++) {
      const index = offset + n; const file = files[n];
      const expected = Math.min(CHUNK_BYTES, row.size_bytes - index * CHUNK_BYTES);
      if (file?.name !== index.toString().padStart(6, "0") || Number(file.metadata?.size) !== expected) throw new Error("Upload size does not match");
    }
  }
}/** Remove storage pieces for an upload row; used by every cleanup path. */
export async function removeChunks(sb: Awaited<ReturnType<typeof db>>, row: { user_id: string; id: string; chunk_count: number }) {
  for (let i = 0; i < row.chunk_count; i += 100) {
    const paths = Array.from({ length: Math.min(100, row.chunk_count - i) }, (_, n) => `${row.user_id}/${row.id}/${(i + n).toString().padStart(6, "0")}`);
    await sb.storage.from("radium-files").remove(paths);
  }
}
/** Chat files that were uploaded but never sent are freed after a few hours. */
export async function cleanupAbandonedUploads(sb: Awaited<ReturnType<typeof db>>, userId: string) {
  const cutoff = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data: stale } = await sb.from("app_uploads").select("id, user_id, chunk_count").eq("user_id", userId).eq("kind", "chat").is("message_id", null).lt("created_at", cutoff).limit(20);
  for (const row of stale ?? []) { await removeChunks(sb, row); await sb.from("app_uploads").delete().eq("id", row.id); }
}

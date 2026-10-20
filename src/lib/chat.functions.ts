import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { canModerate, canCreatePublicRoom } from "./account-permissions";
import { attachmentLimit, type ChatRank } from "./chat-ranks";

const db = async () => (await import("./account-session.server")).db();
const requireUser = async () => (await import("./account-session.server")).requireChatAccess();

const roomId = z.object({ roomId: z.string().uuid() });

async function requireMember(userId: string, rid: string, staff: boolean) {
  if (staff) return;
  const sb = await db();
  const { data } = await sb.from("app_room_members").select("room_id").eq("room_id", rid).eq("user_id", userId).maybeSingle();
  const { data: room } = await sb.from("app_chat_rooms").select("code, is_public").eq("id", rid).maybeSingle();
  if (!data && room?.code !== "general" && !room?.is_public) throw new Error("Join this room first");
}

/** Rooms the user has joined (kept across sign-ins). Staff see every room. */
export const listRooms = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const sb = await db();
  const staff = canModerate(user.role);
  const { data: rooms } = await sb.from("app_chat_rooms").select("id, code, name, created_by, created_at, is_public").order("created_at");
  const { data: mine } = await sb.from("app_room_members").select("room_id").eq("user_id", user.id);
  const joined = new Set((mine ?? []).map((m) => m.room_id));
  return (rooms ?? [])
    .filter((r) => r.code === "general" || r.is_public || joined.has(r.id) || staff)
    .map((r) => ({ id: r.id, code: r.code, name: r.name, isPublic: r.is_public || r.code === "general", joined: r.code === "general" || joined.has(r.id), isCreator: r.created_by === user.id }));
});

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ name: z.string().trim().min(1).max(60), code: z.string().trim().regex(/^[a-zA-Z0-9-]{3,24}$/, "Code must be 3–24 letters, numbers or dashes"), isPublic: z.boolean().default(false) }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (data.isPublic && !canCreatePublicRoom(user.role)) throw new Error("Only mods, admins and the owner can create public chats");
    const sb = await db();
    const { data: row, error } = await sb.from("app_chat_rooms").insert({ name: data.name, code: data.code.toLowerCase(), created_by: user.id, is_public: data.isPublic }).select("id").single();
    if (error || !row) throw new Error(error?.code === "23505" ? "That room code is taken" : "Could not create room");
    await sb.from("app_room_members").insert({ room_id: row.id, user_id: user.id });
    return { id: row.id };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().trim().min(1).max(24) }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = await db();
    const { data: room } = await sb.from("app_chat_rooms").select("id").eq("code", data.code.toLowerCase()).maybeSingle();
    if (!room) throw new Error("No room with that code");
    await sb.from("app_room_members").upsert({ room_id: room.id, user_id: user.id });
    return { id: room.id };
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => roomId.parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = await db();
    await sb.from("app_room_members").delete().eq("room_id", data.roomId).eq("user_id", user.id);
    return { ok: true };
  });

export const deleteRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => roomId.parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!canModerate(user.role)) throw new Error("Only mods and above can delete rooms");
    const sb = await db();
    const { data: room } = await sb.from("app_chat_rooms").select("code").eq("id", data.roomId).maybeSingle();
    if (room?.code === "general") throw new Error("The general room can't be deleted");
    await sb.from("app_chat_rooms").delete().eq("id", data.roomId);
    return { ok: true };
  });

export const listMessages = createServerFn({ method: "GET" })
  .inputValidator((d) => roomId.parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const staff = canModerate(user.role);
    await requireMember(user.id, data.roomId, staff);
    const sb = await db();
    const { data: rows, error } = await sb
      .from("app_chat_messages")
      .select("id, user_id, body, created_at, edited_at, deleted_at, deleted_by_role, app_users(username, avatar, settings)")
      .eq("room_id", data.roomId)
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new Error("Could not load chat");
    const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
    const messageIds = (rows ?? []).map((r) => r.id);
    const [{ data: roles }, { data: extras }, { data: files }] = await Promise.all([
      userIds.length ? sb.from("app_account_roles").select("user_id, role").in("user_id", userIds) : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
      userIds.length ? sb.from("app_extras").select("user_id, chat_rank").in("user_id", userIds) : Promise.resolve({ data: [] as { user_id: string; chat_rank: string | null }[] }),
      messageIds.length ? sb.from("app_uploads").select("id, message_id, name, mime, size_bytes").in("message_id", messageIds).eq("complete", true) : Promise.resolve({ data: [] as { id: string; message_id: string | null; name: string; mime: string; size_bytes: number }[] }),
    ]);
    return (rows ?? []).reverse().map((r) => {
      const deleted = Boolean(r.deleted_at);
      const settings = (r.app_users?.settings ?? null) as { theme?: { accent?: unknown } } | null;
      const accent = typeof settings?.theme?.accent === "string" && /^#[0-9a-f]{3,8}$/i.test(settings.theme.accent) ? settings.theme.accent : null;
      return {
        id: r.id,
        userId: r.user_id,
        username: r.app_users?.username ?? "Deleted user",
        avatar: (r.app_users?.avatar ?? null) as string | null,
        authorRole: (roles?.find((x) => x.user_id === r.user_id)?.role ?? null) as string | null,
        chatRank: (extras?.find((x) => x.user_id === r.user_id)?.chat_rank ?? null) as ChatRank,
        accent,
        // Deleted text and files are only returned to staff, for moderation.
        body: deleted && !staff ? "" : r.body,
        attachments: deleted && !staff ? [] : (files ?? []).filter((f) => f.message_id === r.id).map((f) => ({ id: f.id, name: f.name, mime: f.mime, size: f.size_bytes })),
        createdAt: r.created_at,
        editedAt: r.edited_at,
        deleted,
        deletedBy: r.deleted_by_role,
      };
    });
  });

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ roomId: z.string().uuid(), body: z.string().trim().max(2000), uploadIds: z.array(z.string().uuid()).max(10).default([]) })
    .refine((v) => v.body.length > 0 || v.uploadIds.length > 0, "Write a message or attach a file").parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    await requireMember(user.id, data.roomId, canModerate(user.role));
    const sb = await db();
    const ids = [...new Set(data.uploadIds)];
    if (ids.length) {
      const { data: files } = await sb.from("app_uploads").select("id, size_bytes, room_id, kind, complete, message_id").in("id", ids).eq("user_id", user.id);
      if (!files || files.length !== ids.length || files.some((f) => !f.complete || f.kind !== "chat" || f.room_id !== data.roomId || f.message_id)) throw new Error("An attachment is missing or already sent");
      const { data: extra } = await sb.from("app_extras").select("chat_rank").eq("user_id", user.id).maybeSingle();
      const total = files.reduce((sum, f) => sum + Number(f.size_bytes), 0);
      if (total > attachmentLimit(user.role, (extra?.chat_rank ?? null) as ChatRank)) throw new Error("These files exceed your rank's media limit per message");
    }
    const { data: saved, error } = await sb.from("app_chat_messages").insert({ room_id: data.roomId, user_id: user.id, body: data.body }).select("id, created_at").single();
    if (error || !saved) throw new Error("Could not send message");
    if (ids.length) {
      const { error: linkError } = await sb.from("app_uploads").update({ message_id: saved.id }).in("id", ids).eq("user_id", user.id).is("message_id", null);
      if (linkError) { await sb.from("app_chat_messages").delete().eq("id", saved.id); throw new Error("Could not attach files"); }
    }
    return { id: saved.id, createdAt: saved.created_at };
  });

export const editMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = await db();
    const { data: row } = await sb
      .from("app_chat_messages")
      .update({ body: data.body, edited_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (!row) throw new Error("You can only edit your own messages");
    return { ok: true };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), hard: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = await db();
    const { data: msg } = await sb.from("app_chat_messages").select("user_id").eq("id", data.id).maybeSingle();
    if (!msg) throw new Error("Message not found");
    // Hard delete removes the row entirely so not even staff can see it was
    // there; only the owner can do this.
    if (data.hard) {
      if (user.role !== "owner") throw new Error("Only the owner can completely delete messages");
      // Free the stored file pieces too, so fully deleted media never lingers.
      const { data: files } = await sb.from("app_uploads").select("id, user_id, chunk_count").eq("message_id", data.id);
      const { removeChunks } = await import("./uploads.server");
      for (const f of files ?? []) await removeChunks(sb, f);
      await sb.from("app_chat_messages").delete().eq("id", data.id);
      return { ok: true };
    }
    const own = msg.user_id === user.id;
    if (!own && !canModerate(user.role)) throw new Error("You can only delete your own messages");
    const by = own ? "self" : (user.role as "owner" | "admin" | "mod");
    await sb.from("app_chat_messages").update({ deleted_at: new Date().toISOString(), deleted_by_role: by }).eq("id", data.id);
    return { ok: true };
  });

/** The signed-in user's chat rank and per-message media allowance. */
export const getMyMediaLimit = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const sb = await db();
  const { data: extra } = await sb.from("app_extras").select("chat_rank").eq("user_id", user.id).maybeSingle();
  const chatRank = (extra?.chat_rank ?? null) as ChatRank;
  return { chatRank, limit: attachmentLimit(user.role, chatRank) };
});

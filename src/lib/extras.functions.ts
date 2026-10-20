import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CHAT_RANKS } from "./chat-ranks";
const helpers = () => import("./account-session.server");
export const ownerSetExtras = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), chatRank: z.enum(CHAT_RANKS).nullable().optional(), klebEnabled: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, db } = await helpers();
    const user = await requireUser();
    if (user.role !== "owner") throw new Error("Only the owner can grant Kleb or assign chat ranks");
    const sb = await db();
    const { data: target } = await sb.from("app_account_roles").select("role").eq("user_id", data.id).maybeSingle();
    if (target?.role === "owner" && user.id !== data.id) throw new Error("This account is protected");
    // Kleb has a single holder: granting it revokes everyone else first.
    if (data.klebEnabled) await sb.from("app_extras").update({ kleb_enabled: false }).eq("kleb_enabled", true).neq("user_id", data.id);
    const { error } = await sb.from("app_extras").upsert({ user_id: data.id, ...(data.chatRank !== undefined ? { chat_rank: data.chatRank } : {}), ...(data.klebEnabled !== undefined ? { kleb_enabled: data.klebEnabled } : {}) });
    if (error) throw new Error("Could not save access or rank");
    return { ok: true };
  });

/** Owner grants the single Kleb page to one account, by username. */
export const grantKleb = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ username: z.string().trim().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, db } = await helpers();
    const user = await requireUser();
    if (user.role !== "owner") throw new Error("Only the owner can grant Kleb");
    const sb = await db();
    const { data: target } = await sb.from("app_users").select("id, username").ilike("username", data.username).maybeSingle();
    if (!target) throw new Error("No account with that username");
    const { data: targetRole } = await sb.from("app_account_roles").select("role").eq("user_id", target.id).maybeSingle();
    if (targetRole?.role === "owner" && target.id !== user.id) throw new Error("This account is protected");
    await sb.from("app_extras").update({ kleb_enabled: false }).eq("kleb_enabled", true);
    const { error } = await sb.from("app_extras").upsert({ user_id: target.id, kleb_enabled: true });
    if (error) throw new Error("Could not grant Kleb");
    return { ok: true, username: target.username };
  });

/** Owner revokes Kleb from whoever currently holds it. */
export const revokeKleb = createServerFn({ method: "POST" }).handler(async () => {
  const { requireUser, db } = await helpers();
  const user = await requireUser();
  if (user.role !== "owner") throw new Error("Only the owner can revoke Kleb");
  const sb = await db();
  await sb.from("app_extras").update({ kleb_enabled: false }).eq("kleb_enabled", true);
  return { ok: true };
});

/** The Kleb page: staff and the holder can view; only the holder edits. */
export const getKlebPage = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser, db } = await helpers();
  const user = await requireUser();
  const sb = await db();
  const staff = user.role === "owner" || user.role === "contributor" || user.role === "admin" || user.role === "mod";
  const { data: own } = await sb.from("app_extras").select("kleb_enabled").eq("user_id", user.id).maybeSingle();
  if (!staff && !own?.kleb_enabled) throw new Error("Kleb access has not been granted");
  const { data: holder } = await sb.from("app_extras").select("user_id, kleb_title, kleb_body, kleb_layout").eq("kleb_enabled", true).limit(1).maybeSingle();
  if (!holder) return { holder: null as null, title: "Kleb", body: "", layout: "grid" as const, pictures: [] as { id: string; name: string }[], canEdit: false, isOwner: user.role === "owner" };
  const { data: holderUser } = await sb.from("app_users").select("id, username, avatar").eq("id", holder.user_id).maybeSingle();
  const { data: pictures } = await sb.from("app_uploads").select("id, name").eq("user_id", holder.user_id).eq("kind", "kleb").eq("complete", true).order("created_at", { ascending: false });
  return {
    holder: holderUser ? { id: holderUser.id, username: holderUser.username, avatar: holderUser.avatar as string | null } : null,
    title: holder.kleb_title, body: holder.kleb_body, layout: holder.kleb_layout as "grid" | "list",
    pictures: pictures ?? [],
    canEdit: holder.user_id === user.id,
    isOwner: user.role === "owner",
  };
});
/** Owner-only read of a user's chat rank and Kleb grant for the Console. */
export const ownerGetExtras = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, db } = await helpers();
    const user = await requireUser();
    if (user.role !== "owner") throw new Error("Only the owner can view chat ranks");
    const sb = await db();
    const { data: row } = await sb.from("app_extras").select("chat_rank, kleb_enabled").eq("user_id", data.id).maybeSingle();
    return { chatRank: (row?.chat_rank ?? null) as (typeof CHAT_RANKS)[number] | null, klebEnabled: Boolean(row?.kleb_enabled) };
  });
export const getKleb = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser, db } = await helpers(); const user = await requireUser(); const sb = await db();
  const { data } = await sb.from("app_extras").select("*").eq("user_id", user.id).maybeSingle();
  if (user.role !== "owner" && !data?.kleb_enabled) throw new Error("Kleb access has not been granted");
  const { data: pictures } = await sb.from("app_uploads").select("id,name,size_bytes").eq("user_id", user.id).eq("kind", "kleb").eq("complete", true).order("created_at", { ascending: false });
  return { title: data?.kleb_title ?? "Kleb", body: data?.kleb_body ?? "", layout: data?.kleb_layout ?? "grid", pictures: pictures ?? [] };
});
export const saveKleb = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ title: z.string().trim().min(1).max(60), body: z.string().max(20000), layout: z.enum(["grid", "list"]) }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, db } = await helpers(); const user = await requireUser(); const sb = await db();
    const { data: access } = await sb.from("app_extras").select("kleb_enabled").eq("user_id", user.id).maybeSingle();
    if (user.role !== "owner" && !access?.kleb_enabled) throw new Error("Kleb access has been revoked");
    const { error } = await sb.from("app_extras").upsert({ user_id: user.id, kleb_title: data.title, kleb_body: data.body, kleb_layout: data.layout });
    if (error) throw new Error("Could not save Kleb"); return { ok: true };
  });
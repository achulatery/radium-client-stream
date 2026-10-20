import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { canModerate } from "./account-permissions";

const helpers = () => import("./account-session.server");
const kindSchema = z.enum(["announcement", "update"]);

/** Any signed-in user can read announcements and updates. */
export const listPosts = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ kind: kindSchema }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, db } = await helpers();
    await requireUser();
    const sb = await db();
    const { data: rows } = await sb
      .from("app_posts")
      .select("id, title, body, author_id, created_at")
      .eq("kind", data.kind)
      .order("created_at", { ascending: false })
      .limit(100);
    const authorIds = [...new Set((rows ?? []).map((row) => row.author_id))];
    const { data: authors } = authorIds.length
      ? await sb.from("app_users").select("id, username, avatar").in("id", authorIds)
      : { data: [] as { id: string; username: string; avatar: string | null }[] };
    return (rows ?? []).map((row) => {
      const author = authors?.find((a) => a.id === row.author_id);
      return { id: row.id, title: row.title, body: row.body, createdAt: row.created_at, author: author?.username ?? "Unknown", avatar: author?.avatar ?? null };
    });
  });

/** Only mods, admins and the owner can post. */
export const createPost = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ kind: kindSchema, title: z.string().trim().min(1).max(120), body: z.string().trim().max(5000) }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, db } = await helpers();
    const user = await requireUser();
    if (!canModerate(user.role)) throw new Error("Only mods, admins and the owner can post");
    const sb = await db();
    const { error } = await sb.from("app_posts").insert({ kind: data.kind, title: data.title, body: data.body, author_id: user.id });
    if (error) throw new Error("Could not publish the post");
    return { ok: true };
  });

export const deletePost = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, db } = await helpers();
    const user = await requireUser();
    if (!canModerate(user.role)) throw new Error("Only mods, admins and the owner can delete posts");
    const sb = await db();
    const { error } = await sb.from("app_posts").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete the post");
    return { ok: true };
  });

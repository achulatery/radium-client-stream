import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeYouTubeSettings } from "./youtube-settings";
const helpers = () => import("./account-session.server");

/** Everyone signed in reads the owner's YouTube choice. */
export const getYouTubeSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser, db } = await helpers();
  await requireUser();
  const sb = await db();
  const { data } = await sb.from("app_site_settings").select("value").eq("key", "youtube").maybeSingle();
  return normalizeYouTubeSettings(data?.value);
});

/** Only the owner switches YouTube source and player for everyone. */
export const setYouTubeSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ provider: z.enum(["invidious", "piped"]), player: z.enum(["mirror", "direct"]) }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, db } = await helpers();
    const user = await requireUser();
    if (user.role !== "owner") throw new Error("Only the owner can change YouTube settings");
    const sb = await db();
    const { error } = await sb.from("app_site_settings").upsert({ key: "youtube", value: data, updated_at: new Date().toISOString() });
    if (error) throw new Error("Could not save YouTube settings");
    return data;
  });

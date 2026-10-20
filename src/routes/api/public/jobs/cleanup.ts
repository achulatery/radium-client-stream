import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Hourly backstop: chat messages expire after 3 hours (owner exempt), activity history after 24 hours. */
export const Route = createFileRoute("/api/public/jobs/cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const messageCutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
        const activityCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: owners } = await supabaseAdmin.from("app_account_roles").select("user_id").eq("role", "owner");
        const ownerIds = (owners ?? []).map((o) => o.user_id);
        let messages = supabaseAdmin.from("app_chat_messages").delete().lt("created_at", messageCutoff);
        if (ownerIds.length) messages = messages.not("user_id", "in", `(${ownerIds.join(",")})`);
        const [{ error: messageError }, { error: activityError }] = await Promise.all([
          messages,
          supabaseAdmin.from("app_activity").delete().lt("created_at", activityCutoff),
        ]);
        if (messageError || activityError) return Response.json({ ok: false }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});

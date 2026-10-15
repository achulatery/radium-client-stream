import { createFileRoute } from "@tanstack/react-router";

/** Serves YouTube thumbnails from Radium's own domain so devices never need to reach i.ytimg.com. */
export const Route = createFileRoute("/api/public/thumb")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!/^[\w-]{6,20}$/.test(id)) return new Response("Bad id", { status: 400 });
        for (const name of ["hqdefault", "mqdefault", "default"]) {
          try {
            const res = await fetch(`https://i.ytimg.com/vi/${id}/${name}.jpg`, { signal: AbortSignal.timeout(4000) });
            if (res.ok && (res.headers.get("content-type") ?? "").startsWith("image/")) {
              return new Response(res.body, {
                headers: {
                  "content-type": res.headers.get("content-type")!,
                  "cache-control": "public, max-age=86400",
                },
              });
            }
          } catch {
            /* try next size */
          }
        }
        return new Response("Not found", { status: 404 });
      },
    },
  },
});

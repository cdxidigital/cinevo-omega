import { createFileRoute } from "@tanstack/react-router";
import { safeArtPath } from "@/lib/artwork-model";
import { requireUserId } from "@/lib/auth/verify.server";
import { loadTicket } from "@/lib/playback.server";

export const Route = createFileRoute("/api/art/$ticket")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        let userId: string;
        try {
          userId = await requireUserId();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }
        const path = safeArtPath(new URL(request.url).searchParams.get("path") || "");
        if (!path || path.length > 512) return new Response("No artwork", { status: 404 });
        const ticket = await loadTicket(params.ticket, userId);
        if (!ticket) return new Response("Artwork expired", { status: 410 });
        const base = ticket.url.replace(/\/$/, "");
        let upstream: Response;
        try {
          upstream = await fetch(`${base}${path}`, {
            headers: ticket.headers,
            redirect: "manual",
            signal: AbortSignal.timeout(12000),
          });
        } catch {
          return new Response("Artwork unavailable", { status: 502 });
        }
        const type = upstream.headers.get("content-type") || "";
        if (!upstream.ok || (type && !type.startsWith("image/"))) {
          return new Response("Artwork unavailable", { status: 502 });
        }
        const out = new Headers();
        if (type) out.set("Content-Type", type);
        const length = upstream.headers.get("content-length");
        if (length) out.set("Content-Length", length);
        out.set("Cache-Control", "private, max-age=86400");
        return new Response(upstream.body, { status: 200, headers: out });
      },
    },
  },
});

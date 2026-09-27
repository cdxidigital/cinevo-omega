import { createFileRoute } from "@tanstack/react-router";
import { requireUserId } from "@/lib/auth/verify.server";
import { loadTicket } from "@/lib/playback.server";

function isVideoResponse(status: number, type: string) {
  if (status !== 200 && status !== 206) return false;
  if (!type) return true;
  return !/xml|html|json|text\/plain/i.test(type);
}

function upstreamHeaders(ticketHeaders: Record<string, string>, range: string) {
  const headers = new Headers(ticketHeaders);
  headers.set("Accept-Encoding", "identity");
  if (range) headers.set("Range", range);
  return headers;
}

function passHeaders(upstream: Response, download: boolean) {
  const out = new Headers();
  for (const key of ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition"]) {
    const value = upstream.headers.get(key);
    if (value) out.set(key, value);
  }
  if (!out.has("Accept-Ranges")) out.set("Accept-Ranges", "bytes");
  if (!out.has("Content-Type")) out.set("Content-Type", "video/mp4");
  out.set("Cache-Control", "private, no-store, no-transform");
  if (download) out.set("Content-Disposition", 'attachment; filename="cinevo-original.mp4"');
  return out;
}

export const Route = createFileRoute("/api/stream/$ticket")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        let userId: string;
        try {
          userId = await requireUserId();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }
        const ticket = await loadTicket(params.ticket, userId);
        if (!ticket) return new Response("Playback expired", { status: 410 });
        const download = new URL(request.url).searchParams.get("download") === "1";
        const range = request.headers.get("range") || "";
        if (range.length > 128 || /[\r\n]/.test(range)) return new Response("Invalid range", { status: 400 });
        let upstream: Response;
        try {
          upstream = await fetch(ticket.url, {
            headers: upstreamHeaders(ticket.headers, range),
            redirect: "follow",
          });
        } catch {
          return new Response("CINEVO could not reach that media server.", { status: 502 });
        }
        const type = upstream.headers.get("content-type") || "";
        if (!isVideoResponse(upstream.status, type)) {
          return new Response("The media server did not return a video stream.", { status: 502 });
        }
        return new Response(upstream.body, {
          status: upstream.status,
          headers: passHeaders(upstream, download),
        });
      },
      HEAD: async ({ request, params }) => {
        let userId: string;
        try {
          userId = await requireUserId();
        } catch {
          return new Response(null, { status: 401 });
        }
        const ticket = await loadTicket(params.ticket, userId);
        if (!ticket) return new Response(null, { status: 410 });
        const range = request.headers.get("range") || "";
        if (range.length > 128 || /[\r\n]/.test(range)) return new Response(null, { status: 400 });
        try {
          let upstream = await fetch(ticket.url, {
            method: "HEAD",
            headers: upstreamHeaders(ticket.headers, range),
            redirect: "follow",
          });
          if (upstream.status === 405 || upstream.status === 501) {
            upstream = await fetch(ticket.url, {
              method: "GET",
              headers: upstreamHeaders(ticket.headers, range || "bytes=0-1"),
              redirect: "follow",
            });
            await upstream.body?.cancel();
          }
          if (upstream.status !== 200 && upstream.status !== 206) {
            return new Response(null, { status: 502 });
          }
          return new Response(null, { status: upstream.status, headers: passHeaders(upstream, false) });
        } catch {
          return new Response(null, { status: 502 });
        }
      },
    },
  },
});

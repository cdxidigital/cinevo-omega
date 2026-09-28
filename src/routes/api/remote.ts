import { createFileRoute } from "@tanstack/react-router";
import { UnauthorizedError, isAuthNotConfiguredError, requireUserId } from "@/lib/auth/verify.server";
import { AUTH_NOT_CONFIGURED_MESSAGE } from "@/lib/auth/unavailable";
import { normalizeCode, sanitizeCommand, sanitizeNow } from "@/lib/remote-protocol";
import { closeRemote, openRemote, pushRemoteCommand, readRemote, syncRemote } from "@/lib/remote.server";
import { allowRequest } from "@/lib/rate-limit.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function userId(request: Request): Promise<string> {
  const header = request.headers.get("authorization") || "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : undefined;
  return requireUserId(bearer);
}

export const Route = createFileRoute("/api/remote")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        if (!allowRequest(`remote:get:${clientKey}`, 120)) return json({ ok: false, error: "Too many requests. Try again shortly." }, 429);
        const code = normalizeCode(new URL(request.url).searchParams.get("code"));
        if (!code) return json({ ok: false, error: "Enter the six-character code from the house." }, 400);
        let id: string;
        try {
          id = await userId(request);
        } catch (error) {
          if (isAuthNotConfiguredError(error)) return json({ ok: false, error: AUTH_NOT_CONFIGURED_MESSAGE }, 503);
          return json({ ok: false, error: "Sign in to use the remote." }, 401);
        }
        const row = await readRemote(id, code);
        if (!row) return json({ ok: false, error: "That code is not active. Open CINEVO on the house and start a new one." }, 404);
        return json({ ok: true, now: row.now, ageMs: row.ageMs });
      },
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          const text = await request.text();
          if (text.length > 12_000) return json({ ok: false, error: "That update is too large." }, 413);
          body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
        } catch {
          return json({ ok: false, error: "CINEVO could not read that request." }, 400);
        }
        const action = String(body.action || "");
        const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        if (!allowRequest(`remote:${clientKey}`, 90)) return json({ ok: false, error: "Too many requests. Try again shortly." }, 429);
        try {
          if (action === "open" || action === "rotate" || action === "close") {
            const id = await userId(request);
            if (action === "close") {
              await closeRemote(id, String(body.code || ""));
              return json({ ok: true });
            }
            const session = await openRemote(id, action === "open" ? String(body.code || "") : "");
            return json({ ok: true, ...session });
          }
          if (action === "sync") {
            const id = await userId(request);
            const commands = await syncRemote(id, String(body.code || ""), sanitizeNow(body.now));
            return json({ ok: true, commands });
          }
          if (action === "command") {
            const command = sanitizeCommand(body.command);
            if (!command) return json({ ok: false, error: "That is not a playback control." }, 400);
            const id = await userId(request);
            const ok = await pushRemoteCommand(id, String(body.code || ""), command);
            if (!ok) return json({ ok: false, error: "The house is not accepting that code." }, 404);
            return json({ ok: true });
          }
          return json({ ok: false, error: "Unknown remote action." }, 400);
        } catch (error) {
          if (isAuthNotConfiguredError(error)) return json({ ok: false, error: AUTH_NOT_CONFIGURED_MESSAGE }, 503);
          if (error instanceof UnauthorizedError) return json({ ok: false, error: "Sign in on the house first." }, 401);
          return json({ ok: false, error: "The remote could not reach the house." }, 500);
        }
      },
    },
  },
});

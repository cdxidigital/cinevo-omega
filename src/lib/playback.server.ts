import { getSql } from "@/lib/db";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { jellyfinStreamTarget, nodeStreamTarget, plexStreamTarget, serverAddressError, type PlaybackFit } from "@/lib/playback-urls";

// Playback tickets hold Plex/Jellyfin credentials encrypted at rest. In
// production BETTER_AUTH_SECRET is required (auth fails closed without it), so
// the key is a real secret. Without it — local preview only — a per-process
// random key is used rather than a constant compiled into the public repo:
// tickets live at most 2h and a restart invalidates them anyway, which is the
// trade for a leaked preview database not being decryptable with a known key.
const ticketKey = createHash("sha256")
  .update(process.env.BETTER_AUTH_SECRET || randomBytes(32))
  .digest();
export function encryptTicket(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ticketKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
export function decryptTicket(value: string) {
  try {
    const [iv, tag, payload] = value.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", ticketKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
  } catch { return null; }
}

function ticketId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return `p${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function createTicket(input: {
  userId: string;
  provider: "plex" | "jellyfin" | "node";
  uri: string;
  key: string;
  token: string;
  clientId?: string;
  fit?: PlaybackFit;
}) {
  const uri = input.uri.trim();
  const key = input.key.trim();
  const token = input.token.trim();
  if (!uri || !key || !token) return { ok: false as const, error: "Missing playback details." };
  const blocked = serverAddressError(uri);
  if (blocked) return { ok: false as const, error: blocked };
  const clientId = input.clientId || "cinevo-web";
  const fit = input.fit === "compatible" ? "compatible" : "original";
  const target =
    input.provider === "plex"
      ? plexStreamTarget(uri, key, token, clientId, fit)
      : input.provider === "jellyfin"
        ? jellyfinStreamTarget(uri, key, token, clientId, fit)
        : nodeStreamTarget(uri, token, key, clientId);
  const id = ticketId();
  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const sql = await getSql();
  await sql`delete from cinevo_play_tickets where expires_at < now()`;
  await sql`
    insert into cinevo_play_tickets (id, user_id, provider, url, headers, expires_at)
    values (${id}, ${input.userId}, ${input.provider}, ${target.url}, ${encryptTicket(JSON.stringify(target.headers))}, ${expires}::timestamptz)
  `;
  return { ok: true as const, src: `/api/stream/${id}` };
}

export async function loadTicket(id: string, userId: string) {
  const sql = await getSql();
  const rows = await sql<{
    url: string;
    headers: string | Record<string, string>;
    expires_at: string;
  }>`
    select url, headers, expires_at::text from cinevo_play_tickets
    where id = ${id} and user_id = ${userId} and expires_at > now()
  `;
  const row = rows[0];
  if (!row) return null;
  let headers: Record<string, string> = {};
  try {
    const decrypted = typeof row.headers === "string" ? decryptTicket(row.headers) : null;
    const rawHeaders = decrypted || (typeof row.headers === "string" ? row.headers : null);
    headers = rawHeaders ? (JSON.parse(rawHeaders) as Record<string, string>) : {};
  } catch {
    headers = {};
  }
  if (!Object.keys(headers).length) return null;
  const allowedHeaders = new Set([
    "accept",
    "x-plex-token",
    "x-plex-product",
    "x-plex-client-identifier",
    "x-plex-platform",
    "x-emby-token",
    "x-emby-authorization",
    "authorization",
  ]);
  const safeHeaders = Object.fromEntries(
    Object.entries(headers).filter(
      ([key, value]) => allowedHeaders.has(key.toLowerCase()) && typeof value === "string" && value.length <= 2048,
    ),
  );
  return { url: row.url, headers: safeHeaders };
}

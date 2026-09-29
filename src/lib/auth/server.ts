/**
 * Self-hosted Better Auth for THIS app (server-only).
 *
 * Pre-wired for live preview + deploy — do not rewrite this file. To enable
 * local email/password, flip the flag in `./email-password` only (see auth skill).
 *
 * The app runs its own Better Auth at `/api/auth/*`, so the session cookie stays
 * on this app's own origin. Sign-in federates to the shared **Grok auth broker**
 * (`GROK_AUTH_ISSUER`) via the `genericOAuth` plugin — the broker brokers the
 * upstream sign-in methods (Google, X, …) and holds their shared secrets; this
 * app only holds its own client id/secret and names the upstream it wants via
 * each provider's `idp` hint.
 *
 * Tri-mode:
 *   - Deployed: the deployer injects a per-app `GROK_AUTH_*` + `BETTER_AUTH_URL`
 *     + `DATABASE_URL`, so real federated auth is persisted in Postgres.
 *   - Sandbox live preview: no injection -> falls back to the shared **preview
 *     client** (`./preview`) and derives the preview's `https://*.grok-sandbox.com`
 *     origin from the request, so real sign-in works (no demo users). Sessions
 *     and identities persist in the embedded PGLite DB (same DB as app data);
 *     the process restart wipes both. Live-preview iframe clients use a bearer
 *     token (partitioned cookies) — see `client.ts`.
 *   - Off (`VITE_AUTH_ENABLED=false`, the shipped default): no providers;
 *     `requireUserId` resolves a dev user with no database configured, and
 *     throws fail-closed once `DATABASE_URL` is set (see `verify.server.ts`).
 *
 * NEVER import this from client code — it pulls in `pg` + the preview secret +
 * server-only Better Auth internals. The client uses `@/lib/auth/client`;
 * components read the user via `@/lib/auth/use-current-user`; server functions get
 * a verified id via `@/lib/auth/middleware`.
 */
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { emailAndPasswordEnabled } from "./email-password";
import { GATE_PROVIDER_ID, gateIdentitySessions } from "./gate-session.server";
import { pgliteDialect } from "./pglite-dialect";
import { PREVIEW_ALLOWED_HOSTS } from "./preview";

// Kick (and share) PGLite bootstrap as soon as the auth server module loads.
void ensureDbReady();

/**
 * Preview secret must outlive module reloads: PGLite (and its session rows) is
 * stored on `globalThis`, so an HMR re-eval of this file must NOT mint a new
 * signing secret or every existing session becomes invalid mid-dev. Process
 * restart clears both the secret and PGLite together.
 */
const globalAuthRef = globalThis as typeof globalThis & {
  __grokAuthPreviewSecret__?: string;
};
function previewAuthSecret(): string {
  globalAuthRef.__grokAuthPreviewSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__grokAuthPreviewSecret__;
}

/** Read an env var, treating empty/whitespace as unset. */
const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

// Explicit off-switch. The deployer sets `VITE_AUTH_ENABLED=true` when it
// provisions auth; set it to "false" to force auth off everywhere (dev user).
const authDisabled = env("VITE_AUTH_ENABLED") === "false";

/** Production must use an injected signing secret; preview may use its process-stable fallback. */
const authSecret = env("BETTER_AUTH_SECRET");

/** True when local email/password sign-in is active. */
export const authConfigured = !authDisabled && emailAndPasswordEnabled;

const isProduction = process.env.NODE_ENV === "production";

/**
 * Production with auth on but no signing secret: auth is DISABLED (not made
 * insecure). We never fall back to a hardcoded or per-boot random secret in
 * production. Instead `auth` is `null`, `/api/auth/*` answers 503 and anything
 * that needs a user fails closed, while public pages keep rendering.
 * Dev / live preview is unchanged (process-stable preview secret).
 */
export const authUnavailable = isProduction && authConfigured && !authSecret;

if (isProduction && authConfigured) {
  const missing = [
    !authSecret && "BETTER_AUTH_SECRET",
    !env("BETTER_AUTH_URL") && "BETTER_AUTH_URL",
    !env("DATABASE_URL") &&
      "DATABASE_URL (without it auth and app data use the in-memory PGLite fallback, which wipes all users and sessions on every cold start)",
  ].filter(Boolean);
  if (authUnavailable) {
    console.error(
      `[auth] Sign-in is DISABLED: BETTER_AUTH_SECRET is not set in production. ` +
        `Missing env vars: ${missing.join(", ")}. ` +
        `Public pages still render; /api/auth/* returns 503 and signed-in features are unavailable. ` +
        `Set these on the hosting project (e.g. Vercel > Settings > Environment Variables) and redeploy.`,
    );
  } else if (missing.length > 0) {
    console.warn(`[auth] Production auth is missing recommended env vars: ${missing.join(", ")}.`);
  }
}

// This app's own Better Auth origin. When deployed the deployer injects the
// public URL. In the sandbox live preview there's no fixed URL (each preview gets
// a dynamic `*.grok-sandbox.com` host), so we hand Better Auth a dynamic baseURL:
// it derives the origin per-request from the (proxied) host, validated against the
// preview allowlist, which makes the OAuth `redirect_uri` the concrete preview URL
// the broker's preview client accepts.
const explicitBaseURL = env("BETTER_AUTH_URL");
// Explicit `string[]` (not a readonly tuple) — Better Auth's DynamicBaseURLConfig
// requires a mutable `allowedHosts: string[]`.
const previewAllowedHosts: string[] = [
  ...PREVIEW_ALLOWED_HOSTS,
  // v0 preview deployments use a stable *.v0.build origin rather than the
  // sandbox hostname. Keep this scoped to the preview domain, not all hosts.
  "*.v0.build",
];

const v0PreviewOrigins: string[] = [
  env("V0_RUNTIME_URL"),
  env("V0_DEV_APP_URL"),
  env("V0_BUILD_URL"),
  env("V0_SANDBOX_URL"),
].filter((value): value is string => Boolean(value));

const v0PreviewHosts: string[] = v0PreviewOrigins.flatMap((origin) => {
  try {
    return [new URL(origin).host];
  } catch {
    return [];
  }
});

const allowedPreviewHosts = [...new Set([...previewAllowedHosts, ...v0PreviewHosts])];
// Local `npm run dev` (port 8080 contract). Browsers may send Origin as any of
// these for the same server — trusting only `localhost` rejects `127.0.0.1` and
// breaks email/password with "Invalid origin".
const LOCAL_DEV_ORIGINS: string[] = [
  "http://localhost:3000",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
  "http://[::1]:3000",
  "http://[::1]:8080",
];
const baseURL = explicitBaseURL ?? {
  // Include loopback hosts so dynamic baseURL resolves for local email/password
  // (not only the preview wildcard).
  allowedHosts: [
    ...allowedPreviewHosts,
    "localhost",
    "localhost:3000",
    "localhost:4173",
    "localhost:5173",
    "localhost:8080",
    "127.0.0.1",
    "127.0.0.1:3000",
    "127.0.0.1:4173",
    "127.0.0.1:5173",
    "127.0.0.1:8080",
    "[::1]",
    "[::1]:3000",
    "[::1]:4173",
    "[::1]:5173",
    "[::1]:8080",
  ],
  // `auto` → trust both http:// and https:// expansions of allowedHosts
  // (preview is https; local dev is http).
  protocol: "auto" as const,
  fallback: "http://localhost:8080",
};

// Origins Better Auth accepts on credentialed POSTs (sign-up/sign-in, etc.).
// Missing entries here surface as FORBIDDEN "Invalid origin".
const trustedOrigins: string[] = explicitBaseURL
  ? [explicitBaseURL, ...LOCAL_DEV_ORIGINS]
  : [
      // Only exact configured preview hosts and local development origins are trusted.
      ...allowedPreviewHosts,
      // Trust the exact Vercel/v0 preview origins injected for this project.
      ...v0PreviewOrigins,
      // Full-origin wildcards (matched against Origin)
      ...allowedPreviewHosts.flatMap((host) => [`https://${host}`, `http://${host}`]),
      ...LOCAL_DEV_ORIGINS,
    ];

const databaseUrl = env("DATABASE_URL");

// Real Postgres when `DATABASE_URL` is set (deployed apps), else the app's
// embedded PGLite (preview) via a Kysely dialect — so Better Auth persists to the
// SAME DB as app data, including email/password users. Both use the Better Auth
// schema from `migrations/auth/0001_auth.sql`, copied into `migrations/` when
// the app turns sign-in on.
const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

/** Session token cookie name — also read by the live-preview popup completion page. */
export const SESSION_TOKEN_COOKIE = "__Host-cinevo-auth.session_token";

function createAuth(secret: string) {
  return betterAuth({
    baseURL,
    // Deployed apps inject BETTER_AUTH_SECRET. Preview: process-stable secret on
    // globalThis so HMR doesn't invalidate PGLite-backed sessions (see above).
    secret,
    database,

    // CSRF / origin check for credentialed auth POSTs (email sign-up/sign-in, …).
    // See `trustedOrigins` construction above — must cover live preview hosts AND
    // local loopback variants, or clients get "Invalid origin".
    trustedOrigins,

    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: [GATE_PROVIDER_ID],
      },
    },

    // Cache the session in the short-lived signed `session_data` cookie so reads
    // (incl. the client's `/get-session`) skip the DB — this shrinks the "loading"
    // window and reduces auth flicker. See the `auth` skill for the full
    // flicker-prevention guidance (gate on `isPending`; SSR the session).
    session: { cookieCache: { enabled: true, maxAge: 300 } },

    // Local email/password — toggled only via `./email-password` (not a plugin).
    ...(emailAndPasswordEnabled ? { emailAndPassword: { enabled: true } } : {}),

    // `__Host-` prefixed cookies: the browser REFUSES any same-named cookie that
    // carries a `Domain` attribute, so a sibling `*.grok.me` app cannot "toss" a
    // `Domain=.grok.me` session cookie onto this app. `__Host-` requires Secure +
    // Path=/ + no Domain; Better Auth otherwise uses `__Secure-` (which permits
    // Domain), so we drop its auto prefix (`useSecureCookies: false`) and set
    // Secure + the names ourselves. (Browsers allow Secure cookies on
    // `http://localhost`, so local dev still works.)
    advanced: {
      useSecureCookies: false,
      defaultCookieAttributes: {
        secure: true,
        sameSite: process.env.NODE_ENV === "development" ? ("none" as const) : ("lax" as const),
        path: "/",
      },
      cookies: {
        session_token: { name: SESSION_TOKEN_COOKIE },
        session_data: { name: "__Host-cinevo-auth.session_data" },
        account_data: { name: "__Host-cinevo-auth.account_data" },
        dont_remember: { name: "__Host-cinevo-auth.dont_remember" },
      },
    },

    plugins: [
      gateIdentitySessions(),

      // Accept `Authorization: Bearer <session-token>` as an alternative to the
      // cookie. Needed for the LIVE PREVIEW: the app runs in an embedded iframe
      // where cookies are partitioned, so after popup sign-in it authenticates with
      // a bearer token instead (see `client.ts` / the `auth` skill). The hook only
      // fires when an Authorization header is present, so the cookie path
      // (deployed apps) is unaffected.
      bearer(),

      // Bridges Better Auth's Set-Cookie into TanStack Start responses. MUST be
      // last so it runs after every other plugin's hooks.
      tanstackStartCookies(),
    ],
  });
}

/**
 * This app's Better Auth instance, or `null` when auth is unavailable (production
 * without `BETTER_AUTH_SECRET`, see `authUnavailable`). Callers must handle `null`
 * by failing closed (503 / `AuthNotConfiguredError`), never by skipping auth.
 */
// Production never signs with the preview fallback: no real secret -> no auth.
export const auth: ReturnType<typeof createAuth> | null =
  isProduction && !authSecret ? null : createAuth(authSecret ?? previewAuthSecret());

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}

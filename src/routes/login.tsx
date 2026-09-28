import { createFileRoute, Link, Navigate, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient, authEnabled, rememberSessionToken, sessionTokenFromAuthResponse } from "@/lib/auth/client";
import { Logo } from "@/components/cinevo/logo";
import { claimUsername } from "@/lib/sharing";
import { appDestination } from "@/lib/app-destination";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === "up" ? ("up" as const) : ("in" as const),
    ...appDestination(search),
  }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const { mode: initial, room, core } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  // Set by the root loader when the server has sign-in disabled for missing
  // production config (see `@/lib/auth/unavailable`).
  const authUnavailableMessage = useRouteContext({
    from: "__root__",
    select: (ctx) =>
      ctx.sessionUser && "authNotConfigured" in ctx.sessionUser ? ctx.sessionUser.error : null,
  });

  useEffect(() => {
    setMode(initial);
  }, [initial]);

  if (isPending) {
    return (
      <main className="login-stage">
        <div className="login-card">
          <div className="h-8 w-28 animate-pulse rounded bg-cine-surface" />
          <div className="mt-6 h-10 w-56 animate-pulse rounded bg-cine-surface" />
          <div className="mt-3 h-4 w-full animate-pulse rounded bg-cine-surface" />
          <div className="mt-8 h-12 w-full animate-pulse rounded-xl bg-cine-surface" />
          <div className="mt-2 h-12 w-full animate-pulse rounded-xl bg-cine-surface" />
        </div>
      </main>
    );
  }

  if (!isPending && user && !user.isDevFallback) {
    return <Navigate to="/app" search={{ ...(room ? { room } : {}), ...(core ? { core } : {}) }} />;
  }

  const afterEmail = async (name: string) => {
    if (name.trim()) {
      try {
        await claimUsername({ data: { username: name.trim(), display: name.trim() } });
      } catch {
        /* UsernameGate will retry on /app */
      }
    }
    void nav({ to: "/app", search: { ...(room ? { room } : {}), ...(core ? { core } : {}) } });
  };

  const keepSession = {
    onSuccess(context: { response: Response }) {
      rememberSessionToken(sessionTokenFromAuthResponse(context.response.headers.get("set-auth-token")));
    },
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: username.trim() || email.split("@")[0],
          fetchOptions: keepSession,
        });
        if (err) {
          setError(err.message || "Could not create that account.");
          return;
        }
        await afterEmail(username);
      } else {
        const { error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
          fetchOptions: keepSession,
        });
        if (err) {
          setError(err.message || "Email or password did not match.");
          return;
        }
        void nav({ to: "/app", search: { ...(room ? { room } : {}), ...(core ? { core } : {}) } });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="login-stage">
      <div className="login-card">
        <Link to="/" className="mb-8 inline-flex">
          <Logo size="lg" layout="stacked" />
        </Link>
        <p className="font-ui text-xs font-semibold tracking-[0.12em] text-cine-cyan">CINEVO · PRIVATE CINEMA</p>
        <h1 className="mt-3 font-ui text-4xl font-semibold leading-tight tracking-tight">
          {mode === "up" ? "Create your house." : "Take your seat."}
        </h1>
        <p className="mt-3 text-sm text-cine-muted">
          A username lets friends share Plex and Jellyfin catalogs with you. Your dashboard stays private until you sign in.
        </p>

        {authEnabled ? (
          <>
            {authUnavailableMessage ? (
              <div role="alert" className="mt-8 rounded-xl border border-cine-border bg-cine-elevated p-4 text-sm text-cine-danger">
                {authUnavailableMessage} Please try again later.
              </div>
            ) : (
              <div className="mt-8 rounded-xl border border-cine-border bg-cine-elevated p-4 text-sm text-cine-muted">
                Sign in securely with your Cinevo account. Your session stays on this app and is never sent to a third-party broker.
              </div>
            )}
            <form onSubmit={(e) => void submit(e)} className="grid gap-3">
              {mode === "up" ? (
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  autoComplete="username"
                  aria-label="Username"
                  required
                  minLength={3}
                  maxLength={20}
                  pattern="[A-Za-z][A-Za-z0-9_]{2,19}"
                  title="3–20 letters, numbers, or underscores, starting with a letter"
                  className="h-12 rounded-xl border border-cine-border bg-cine-well px-4 font-ui"
                />
              ) : null}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                required
                aria-label="Email"
                className="h-12 rounded-xl border border-cine-border bg-cine-well px-4 font-ui"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                required
                minLength={8}
                aria-label="Password"
                className="h-12 rounded-xl border border-cine-border bg-cine-well px-4 font-ui"
              />
              {error ? <p className="text-sm text-cine-danger">{error}</p> : null}
              <p className="text-xs text-cine-faint">Password at least 8 characters.{mode === "up" ? " Username: 3–20 letters, numbers, or underscores." : ""}</p>
              <button type="submit" disabled={pending || Boolean(authUnavailableMessage)} className="house-btn house-btn--play h-12 w-full">
                {pending ? "Working…" : mode === "up" ? "Create account" : "Sign in"}
              </button>
            </form>
            <button
              type="button"
              className="mt-5 font-ui text-sm text-cine-cyan"
              onClick={() => {
                setMode(mode === "up" ? "in" : "up");
                setError("");
              }}
            >
              {mode === "up" ? "Already have a house? Sign in" : "New here? Create an account"}
            </button>
          </>
        ) : (
          <p className="mt-8 text-sm text-cine-muted">Sign-in is disabled.</p>
        )}
      </div>
    </main>
  );
}

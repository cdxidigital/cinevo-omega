# Security & Compliance

## Authentication

- Better Auth is used for identity and session management.
- The auth schema is defined in `migrations/0001_auth.sql` and is the source of truth for user/session/account tables.
- `SESSION_SECRET` must be configured in production and must never be committed to the repository.
- Do not log secrets or session tokens.

## Data privacy

- Personal media access must remain scoped to the authenticated user or the user's own local environment.
- Plex/Jellyfin credentials and local library paths should remain under the user's control and not be persisted to shared infrastructure without explicit consent.
- Playback is proxied only through the user's valid media host or through the local Node companion when applicable.

## Deployment

- `DATABASE_URL` must be set in production to a managed Postgres provider such as Neon.
- Never commit or expose `.env` files or secret values.
- Keep all user-specific data queries scoped by `user_id` or by the authenticated user context.
- Validate auth gates before exposing any server-side data or mutation.

## Local preview

- The local preview may fall back to PGLite when `DATABASE_URL` is unset.
- This is for development convenience only and should not be used as a production data store.

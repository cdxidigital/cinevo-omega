import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Shell } from "@/components/cinevo/shell";
import { RoomSwitch } from "@/components/cinevo/rooms";
import {
  CoreModal,
  Detail,
  NoticesOverlay,
  SearchOverlay,
  SettingsModal,
  Toast,
} from "@/components/cinevo/overlays";
import { Player } from "@/components/cinevo/player";
import { Keys } from "@/components/cinevo/keys";
import { RemoteBridge } from "@/components/cinevo/remote-bridge";
import { Logo } from "@/components/cinevo/logo";
import { appDestination, roomFromParam } from "@/lib/app-destination";
import { useCinevo } from "@/lib/cinevo-store";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authClient, getBearerToken } from "@/lib/auth/client";

export const Route = createFileRoute("/app")({
  validateSearch: (search: Record<string, unknown>) => appDestination(search),
  component: Cinema,
});

function AppSkeleton() {
  return (
    <div className="cinevo-house min-h-screen bg-cine-bg text-cine-text">
      <header className="top-nav">
        <span className="top-nav__brand">
          <Logo size="sm" tagline={false} />
        </span>
      </header>
      <div className="px-[max(5vw,1.25rem)] py-24">
        <div className="h-3 w-28 animate-pulse rounded bg-cine-surface" />
        <div className="mt-4 h-12 w-64 max-w-full animate-pulse rounded bg-cine-surface" />
        <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-cine-surface" />
        <div className="mt-8 h-11 w-40 animate-pulse rounded-md bg-cine-surface" />
      </div>
    </div>
  );
}

function Cinema() {
  const { user, isPending } = useCurrentUserState();
  const sessionRetry = useRef(false);
  const room = useCinevo((s) => s.room);
  const setRoom = useCinevo((s) => s.setRoom);
  const setCoreOpen = useCinevo((s) => s.setCoreOpen);
  const search = Route.useSearch();

  useEffect(() => {
    const next = roomFromParam(search.room);
    if (next) setRoom(next);
    if (search.core) setCoreOpen(true, search.core);
  }, [search.room, search.core, setRoom, setCoreOpen]);

  if (isPending) return <AppSkeleton />;
  if (!user && getBearerToken() && !sessionRetry.current) {
    sessionRetry.current = true;
    void authClient.getSession();
    return <AppSkeleton />;
  }
  if (!user) {
    return (
      <Navigate
        to="/login"
        search={{
          mode: "in",
          ...(search.room ? { room: search.room } : {}),
          ...(search.core ? { core: search.core } : {}),
        }}
      />
    );
  }

  return (
    <Shell
      overlays={
        <>
          <Detail />
          <SearchOverlay />
          <SettingsModal />
          <CoreModal />
          <NoticesOverlay />
          <Player />
          <Toast />
        </>
      }
    >
      <Keys />
      <RemoteBridge />
      <RoomSwitch room={room} />
    </Shell>
  );
}

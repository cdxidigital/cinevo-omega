import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicFrame } from "@/components/cinevo/public-frame";

export const Route = createFileRoute("/legal/privacy")({ component: Privacy });

function Privacy() {
  return (
    <PublicFrame
      kicker="PRIVACY"
      title="Your media stays yours."
      lede="CINEVO is a private house for libraries you control. It is not a public streaming service."
    >
      <section>
        <h2>Account</h2>
        <p>Sign-in uses your email and password. Your username is how friends address a share. It is not a public profile.</p>
      </section>
      <section>
        <h2>Libraries</h2>
        <p>Folder scans keep names in this browser. Plex and Jellyfin credentials stay with those servers. CINEVO indexes the titles you choose so the house can list them. Playback is proxied. Files are not republished.</p>
      </section>
      <section>
        <h2>On this device</h2>
        <p>Progress, My List, theme, and layout stay in this browser until you clear local data in Settings.</p>
      </section>
      <section>
        <h2>Ask CINEVO</h2>
        <p>Suggestions run only after you opt in, and only against titles already in this house. Nothing is asked until you send a question.</p>
      </section>
      <section>
        <h2>Sharing</h2>
        <p>
          An invite shows a catalog to one username. It does not copy files. Manage invites from <Link to="/app" search={{ core: "sharing" }}>Sharing</Link>.
        </p>
      </section>
    </PublicFrame>
  );
}

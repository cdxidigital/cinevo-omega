import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowRight, Check, Play, ShieldCheck } from "lucide-react";
import { InstallerCards, PhoneApps } from "@/components/cinevo/installers";
import { Logo, Mark } from "@/components/cinevo/logo";
import { LandingAuth } from "@/components/cinevo/account";
import { Reveal, useParallax } from "@/components/cinevo/cine-motion";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

const STEPS = [
  { n: "01", t: "Pick a source", d: "Plex, Jellyfin, a folder on this computer, or CINEVO Node — one wizard, one library at a time." },
  { n: "02", t: "Choose sections", d: "Select only the movie and series libraries you want CINEVO to index." },
  { n: "03", t: "Make it yours", d: "Your connected library appears only after your choice. Nothing is published." },
];

const HIGHLIGHTS = [
  {
    n: "01",
    eyebrow: "PRIVATE LIBRARIES",
    title: "Choose exactly what belongs in view.",
    description: "Folders, Plex, or Jellyfin. Select the sections CINEVO may index. Playback is proxied through CINEVO for servers you own.",
    action: "Set up libraries",
    search: { room: "library" as const },
  },
  {
    n: "02",
    eyebrow: "FRIEND SHARING",
    title: "Share with care, never by default.",
    description: "Invite by CINEVO username. Share Plex and Jellyfin catalogs — never the files. Playback stays on the original server.",
    action: "Manage sharing",
    search: { core: "sharing" as const },
  },
  {
    n: "03",
    eyebrow: "CINEVO CORE",
    title: "A quieter way to care for your collection.",
    description: "Library health, setup, and consent — without turning private media into a social performance.",
    action: "Explore Core",
    search: { core: "libraries" as const },
  },
  {
    n: "04",
    eyebrow: "CONSENT-LED AI",
    title: "Thoughtful suggestions on your terms.",
    description: "Ask only the titles already in this house. Nothing leaves until you opt in.",
    action: "See AI controls",
    search: { core: "ai" as const },
  },
];

function EnterHouse({ className = "public-primary", label = "Enter CINEVO" }: { className?: string; label?: string }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || !user || user.isDevFallback) {
    return (
      <Link to="/login" search={{ mode: "in" }} className={className}>
        <Play size={15} fill="currentColor" /> {label}
      </Link>
    );
  }
  return (
    <Link to="/app" className={className}>
      <Play size={15} fill="currentColor" /> {label}
    </Link>
  );
}

function Home() {
  const chapterStill = useParallax(32);

  return (
    <div className="public-home">
      <header className="public-nav">
        <nav aria-label="Homepage">
          <Link to="/app" search={{ room: "library" }}>
            Your library
          </Link>
          <Link to="/node">Node</Link>
          <Link to="/help">Help</Link>
        </nav>
        <div className="public-nav__actions">
          <LandingAuth />
        </div>
      </header>

      <main>
        <section className="public-hero" aria-labelledby="public-hero-title">
          <img src="/stills/hero-theater.jpg" alt="" className="public-hero__still" />
          <div className="public-hero__veil" />
          <div className="public-hero__beam" aria-hidden="true" />
          <div className="public-hero__orbit public-hero__orbit--one" aria-hidden="true" />
          <div className="public-hero__orbit public-hero__orbit--two" aria-hidden="true" />
          <div className="public-hero__scanline" aria-hidden="true" />
          <div className="public-hero__content">
            <Logo size="xl" layout="stacked" tagline={false} className="public-hero__logo" />
            <h1 id="public-hero-title">
              <span>Your media.</span>
              <em>Your moment.</em>
            </h1>
            <p>
              The libraries you control, in one private house. Folders, Plex, and Jellyfin — shared by username, never
              published.
            </p>
            <div className="public-hero__actions">
              <EnterHouse label="Play your library" />
              <Link to="/login" search={{ mode: "up" }} className="public-secondary">
                Create account <ArrowDownRight size={16} />
              </Link>
            </div>
            <div className="public-hero__note">
              <ShieldCheck size={16} />
              <span>
                <b>Private from the first connection</b>
                <small>Personal media stays on your computer or the server you own.</small>
              </span>
            </div>
          </div>
        </section>

        <section className="home-reel" aria-labelledby="home-reel-title">
          <Reveal as="header">
            <div>
              <span className="public-kicker">START WITH YOUR LIBRARY</span>
              <h2 id="home-reel-title">Nothing appears here until you choose it.</h2>
            </div>
            <p>CINEVO never fills your library with sample media or imported catalogue data.</p>
          </Reveal>
          <div className="home-library-steps">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} as="article" delay={i * 90}>
                <span>{step.n}</span>
                <h3>{step.t}</h3>
                <p>{step.d}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="public-chapter" id="libraries">
          <img ref={chapterStill} src="/stills/doorway.jpg" alt="" className="public-chapter__still" />
          <div className="public-chapter__veil" />
          <div className="home-manifesto">
            <Reveal className="home-manifesto__intro">
              <span className="public-kicker">THE PRIVATE MEDIA OS</span>
              <h2>
                Every library is personal.
                <br />
                <em>So CINEVO starts with permission.</em>
              </h2>
              <p>
                Bring together the media you own and host without turning it into someone else’s platform. Folders on this
                computer. Plex at home or remote. Jellyfin from the library wizard.
              </p>
              <Link to="/app" search={{ room: "library" }} className="public-text-link">
                Connect a library <ArrowRight size={15} />
              </Link>
            </Reveal>
            <Reveal className="home-manifesto__rules" delay={120}>
              <div>
                <Check size={17} />
                <span>
                  <b>Select libraries deliberately</b>
                  <small>Choose the individual sections CINEVO can see.</small>
                </span>
              </div>
              <div>
                <Check size={17} />
                <span>
                  <b>Keep sharing intentional</b>
                  <small>Invite by username. Share the catalog, not the files.</small>
                </span>
              </div>
              <div>
                <Check size={17} />
                <span>
                  <b>Stay in control of AI</b>
                  <small>Opt in and set the metadata scope for each request.</small>
                </span>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="home-highlights" id="sharing" aria-labelledby="home-highlights-title">
          <Reveal as="header">
            <span className="public-kicker">A MORE CONSIDERED MEDIA LIFE</span>
            <h2 id="home-highlights-title">
              Everything useful.
              <br />
              Nothing extractive.
            </h2>
          </Reveal>
          <div className="home-highlights__grid">
            {HIGHLIGHTS.map((item, i) => (
              <Reveal key={item.n} delay={i * 70}>
                <Link to="/app" search={item.search} className="home-highlight">
                  <span>{item.n}</span>
                  <em>{item.eyebrow}</em>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <b>
                    {item.action} <ArrowRight size={14} />
                  </b>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="home-downloads" id="downloads">
          <Reveal>
            <span className="public-kicker">CINEVO NODE</span>
            <h2 className="mt-4 font-ui text-4xl font-semibold leading-tight tracking-tight md:text-5xl">The projector lives at home.</h2>
            <p className="mt-4 mb-10 max-w-xl text-sm text-cine-muted">
              Install Node on the computer that holds the files. Pair once. Jellyfin and disk paths stay on loopback.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <InstallerCards />
          </Reveal>
          <Reveal delay={120}>
            <p className="public-kicker mt-14">PHONE REMOTE</p>
            <h2 className="mt-4 font-ui text-3xl font-semibold tracking-tight md:text-4xl">Android, and current iPhone.</h2>
            <p className="mt-3 mb-6 max-w-xl text-sm text-cine-muted">
              The phone controls the house. It does not play the file. Cast and AirPlay stay on the screen that has the video.
            </p>
            <PhoneApps />
          </Reveal>
        </section>

        <section className="home-closing">
          <Reveal>
            <span className="public-kicker">
              <Mark className="public-kicker__gem" /> CINEVO · CINEMA, REINVENTED
            </span>
            <h2>
              A home for your
              <br />
              <em>entire world of stories.</em>
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p>Connect the library you trust. Claim a username. Then settle in.</p>
            <EnterHouse label="Begin with your library" />
          </Reveal>
        </section>
      </main>

      <footer className="public-footer">
        <Link to="/" className="public-brand" aria-label="CINEVO home">
          <Logo size="lg" layout="stacked" />
        </Link>
        <div>
          <p>Cinema, reinvented. Your media. Your moment.</p>
          <nav className="public-footer__links" aria-label="More">
            <Link to="/node">Node</Link>
            <Link to="/help">Help</Link>
            <Link to="/legal/privacy">Privacy</Link>
            <Link to="/legal/terms">Terms</Link>
          </nav>
        </div>
        <EnterHouse className="public-footer__enter" label="Enter CINEVO" />
      </footer>
    </div>
  );
}

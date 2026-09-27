import { Play, Shuffle, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  MOODS,
  byMood,
  filterCatalog,
  genresIn,
  pickFeatured,
  recentlyAdded,
  type Title,
} from "@/lib/catalog";
import { titleById, useCinevo, type Room, type SourceFilter } from "@/lib/cinevo-store";
import { mostPlayed, tasteFrom } from "@/lib/house-tools";
import { useLibrary } from "@/lib/use-library";
import { Rail, ArtImage, LibraryBoard } from "./poster";
import { AddLibrary } from "./add-library";
import { ToolsRoom } from "./tools-room";
import { BrandKicker } from "./logo";

const SOURCES: [SourceFilter, string][] = [
  ["all", "All"],
  ["folder", "Folders"],
  ["plex", "Plex"],
  ["jellyfin", "Jellyfin"],
  ["shared", "Shared"],
];

function HeroActions({
  onPlay,
  playLabel,
  onMore,
  moreLabel = "More info",
  extra,
  playIcon = true,
}: {
  onPlay: () => void;
  playLabel: string;
  onMore: () => void;
  moreLabel?: string;
  extra?: React.ReactNode;
  playIcon?: boolean;
}) {
  return (
    <div className="house-actions">
      <button type="button" onClick={onPlay} className="house-btn house-btn--play">
        {playIcon ? <Play size={16} fill="currentColor" /> : null} {playLabel}
      </button>
      <button type="button" onClick={onMore} className="house-btn house-btn--ghost">
        {moreLabel}
      </button>
      {extra}
    </div>
  );
}

function PlatformArc({ quiet = false }: { quiet?: boolean }) {
  const setRoom = useCinevo((s) => s.setRoom);
  const setCoreOpen = useCinevo((s) => s.setCoreOpen);
  const cards = [
    {
      title: "Private libraries",
      copy: "Folders on this computer, Plex, or Jellyfin. Node for disk paths on another machine.",
      action: "Open",
      onClick: () => setRoom("sidebar"),
    },
    {
      title: "Friend sharing",
      copy: "Invite by username. Share Plex and Jellyfin catalogs — playback stays on the original server.",
      action: "Share",
      onClick: () => setCoreOpen(true, "sharing"),
    },
    {
      title: "Library care",
      copy: "Stewardship for the collection. No watch-time scores. No social pressure.",
      action: "Review",
      onClick: () => setCoreOpen(true, "stewardship"),
    },
    {
      title: "Consent-led AI",
      copy: "Ask the titles already in this house. Nothing leaves until you opt in.",
      action: "Ask",
      onClick: () => setCoreOpen(true, "ai"),
    },
  ];
  return (
    <section className="platform-arc">
      <header>
        <h2>{quiet ? "Also in this house" : "Start with a library you control."}</h2>
        {quiet ? null : (
          <p>Folders, Plex, or Jellyfin. Nothing is added until you choose it. Playback stays on servers you own.</p>
        )}
      </header>
      <div className="platform-arc__grid">
        {cards.map((card) => (
          <button key={card.title} type="button" className="arc-card" onClick={card.onClick}>
            <b>{card.title}</b>
            <span>{card.copy}</span>
            <i>{card.action}</i>
          </button>
        ))}
      </div>
    </section>
  );
}

export function StageRoom() {
  const play = useCinevo((s) => s.play);
  const openTitle = useCinevo((s) => s.openTitle);
  const progress = useCinevo((s) => s.progress);
  const favorites = useCinevo((s) => s.favorites);
  const tonight = useCinevo((s) => s.tonight);
  const mood = useCinevo((s) => s.mood);
  const shufflePlay = useCinevo((s) => s.shufflePlay);
  const setCoreOpen = useCinevo((s) => s.setCoreOpen);
  const setRoom = useCinevo((s) => s.setRoom);
  const sourceFilter = useCinevo((s) => s.sourceFilter);
  const setSourceFilter = useCinevo((s) => s.setSourceFilter);
  const setMood = useCinevo((s) => s.setMood);
  const sources = useCinevo((s) => s.sources);
  const plays = useCinevo((s) => s.plays);
  const collections = useCinevo((s) => s.collections);
  const hydrated = useCinevo((s) => s.hydrated);
  const library = useLibrary();

  const pool = byMood(mood, library);
  const hero = pickFeatured({ mood, progress, tonight, pool: library });
  const heroProgress = hero ? progress[hero.id] ?? 0 : 0;
  const continueWatching = library.filter((t) => {
    const p = progress[t.id];
    return p != null && p > 0 && p < 100;
  });
  const added = recentlyAdded(12, pool);
  const myList = library.filter((t) => favorites.includes(t.id));
  const taste = useMemo(() => tasteFrom(library, favorites, progress), [library, favorites, progress]);
  const suggestions = useMemo(() => {
    const addedIds = new Set(added.map((t) => t.id));
    const base = pool.filter((t) => !favorites.includes(t.id) && !addedIds.has(t.id));
    if (!taste.length) return base.slice(0, 12);
    const weight = new Map(taste.map((item) => [item.genre, item.count]));
    const score = (title: Title) =>
      (title.genres?.length ? title.genres : [title.genre]).reduce((n, genre) => n + (weight.get(genre) ?? 0), 0);
    return [...base].sort((a, b) => score(b) - score(a)).slice(0, 12);
  }, [added, pool, favorites, taste]);
  const played = useMemo(() => mostPlayed(library, plays, 10).map((row) => row.title), [library, plays]);
  const queued = tonight
    .map((id) => titleById(id))
    .filter((t): t is Title => Boolean(t));

  const still = hero?.still || "/stills/hero-theater.jpg";

  return (
    <div className="house-home">
      <section className="house-hero" aria-labelledby="featured-title">
        <ArtImage src={still} fallback="/stills/hero-theater.jpg" className="house-hero__art" />
        <div className="house-hero__shade" />
        <div className="house-hero__copy">
          {hero ? (
            <p className="house-kicker">{hero.kind === "series" ? "Series" : "Film"}</p>
          ) : (
            <BrandKicker>Private by design</BrandKicker>
          )}
          <h1 id="featured-title">{hero ? hero.title : "Your media. Your moment."}</h1>
          {hero ? (
            <>
              <p className="house-meta">
                <span>{hero.year}</span>
                <i />
                <span>{hero.runtime}</span>
                <i />
                <span>{hero.genre}</span>
                {hero.rating > 0 ? (
                  <>
                    <i />
                    <span>
                      <Star size={12} className="inline text-cine-amber" fill="currentColor" /> {hero.rating.toFixed(1)}
                    </span>
                  </>
                ) : null}
              </p>
              <p className="lede lede--clamp">{hero.synopsis}</p>
              <HeroActions
                onPlay={() => play(hero.id)}
                playLabel={heroProgress > 0 && heroProgress < 100 ? "Resume" : "Play"}
                onMore={() => openTitle(hero.id)}
                extra={
                  <button type="button" onClick={shufflePlay} className="house-btn house-btn--ghost">
                    <Shuffle size={16} /> Surprise me
                  </button>
                }
              />
            </>
          ) : (
            <>
              <p className="lede">
                {hydrated
                  ? "Connect Plex, Jellyfin, a folder on this computer, or Node. Your titles appear here — nothing is published, and nothing is filled in for you."
                  : "Opening your house…"}
              </p>
              {hydrated ? (
                <HeroActions
                  onPlay={() => setRoom("sidebar")}
                  playLabel="Add library"
                  playIcon={false}
                  onMore={() => setCoreOpen(true, "libraries")}
                  moreLabel="Open Core"
                />
              ) : (
                <div className="mt-8 h-11 w-48 animate-pulse rounded-md bg-cine-surface" />
              )}
            </>
          )}
        </div>
      </section>

      <div className="house-stage">
        {library.length ? (
          <>
            <div className="house-filters">
              {sources.length > 1 ? (
                <div className="house-sources" role="tablist" aria-label="Sources">
                  {SOURCES.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={sourceFilter === id}
                      onClick={() => setSourceFilter(id)}
                      className={sourceFilter === id ? "house-chip is-on" : "house-chip"}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="house-sources" role="tablist" aria-label="Mood">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={mood === m.id}
                    onClick={() => setMood(m.id)}
                    className={mood === m.id ? "house-chip is-on" : "house-chip"}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="house-library">
              <div className="house-rails">
                {continueWatching.length ? <Rail heading="Continue watching" titles={continueWatching} wide /> : null}
                {queued.length ? <Rail heading="Up next" titles={queued} wide /> : null}
                {played.length ? <Rail heading="Most played here" titles={played} /> : null}
                {added.length ? <Rail heading="Recently added" titles={added} /> : null}
                {suggestions.length ? <Rail heading="For you" titles={suggestions} /> : null}
                {myList.length ? <Rail heading="My List" titles={myList} /> : null}
                {collections.map((collection) => {
                  const titles = collection.titleIds
                    .map((id) => library.find((title) => title.id === id))
                    .filter((title): title is NonNullable<typeof title> => Boolean(title));
                  if (!titles.length) return null;
                  return <Rail key={collection.id} heading={collection.name} titles={titles} />;
                })}
              </div>
              <PlatformArc quiet />
            </div>
          </>
        ) : (
          <div className="house-library">
            <PlatformArc />
          </div>
        )}
      </div>
    </div>
  );
}

export function BrowseRoom({ kind: initialKind = "all" }: { kind?: "all" | "movie" | "series" }) {
  const [kind, setKind] = useState<"all" | "movie" | "series">(initialKind);
  const [genre, setGenre] = useState("All");
  useEffect(() => {
    setKind(initialKind);
    setGenre("All");
  }, [initialKind]);
  const library = useLibrary();
  const titles = useMemo(() => filterCatalog({ kind, genre, pool: library }), [kind, genre, library]);
  const genres = genresIn(library);
  const heading = initialKind === "movie" ? "Movies" : initialKind === "series" ? "TV Shows" : "Browse";
  return (
    <div className="house-page">
      <header>
        <BrandKicker>CINEVO library</BrandKicker>
        <h1>{heading}</h1>
        <p className="lede">Find something worth disappearing into.</p>
      </header>
      <div className="house-sources mb-4">
        {(["all", "movie", "series"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={kind === k ? "house-chip is-on" : "house-chip"}
          >
            {k === "all" ? "All" : k === "movie" ? "Movies" : "Series"}
          </button>
        ))}
      </div>
      {genres.length > 1 ? (
        <div className="house-sources mb-8">
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(g)}
              className={genre === g ? "house-chip is-on" : "house-chip"}
            >
              {g}
            </button>
          ))}
        </div>
      ) : null}
      <LibraryBoard
        titles={titles}
        empty="No titles yet. Import a library from Plex, Jellyfin, a folder, or Node."
      />
    </div>
  );
}

export function SidebarRoom() {
  const local = useCinevo((s) => s.localTitles);
  const remote = useCinevo((s) => s.remoteTitles);
  const yours = [...local, ...remote];
  return (
    <div className="house-page house-page--flow">
      <header>
        <BrandKicker>CINEVO · Add sources</BrandKicker>
        <h1>Add sources</h1>
        <p className="lede">
          Folders scan in this browser. Sign in with Plex or Jellyfin to index and proxy playback. Pair Node for disk
          paths on another computer.
        </p>
      </header>
      <AddLibrary />
      {yours.length ? (
        <div className="mt-10">
          <h2 className="rail-heading">In your library</h2>
          <LibraryBoard titles={yours} />
        </div>
      ) : null}
    </div>
  );
}

export function RoomSwitch({ room }: { room: Room }) {
  switch (room) {
    case "browse":
      return <BrowseRoom />;
    case "movies":
      return <BrowseRoom kind="movie" />;
    case "shows":
      return <BrowseRoom kind="series" />;
    case "sidebar":
      return <SidebarRoom />;
    case "tools":
      return <ToolsRoom />;
    default:
      return <StageRoom />;
  }
}

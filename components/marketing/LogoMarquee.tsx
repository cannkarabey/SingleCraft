import {
  siArxiv,
  siGithub,
  siProducthunt,
  siReddit,
  siRss,
  siYcombinator,
} from "simple-icons";

// Nominative use: these are the services SignalCraft reads from. Hacker News is shown with
// the Y Combinator mark it uses.
const LOGOS = [
  { name: "Hacker News", icon: siYcombinator },
  { name: "GitHub", icon: siGithub },
  { name: "Product Hunt", icon: siProducthunt },
  { name: "arXiv", icon: siArxiv },
  { name: "Reddit", icon: siReddit },
  { name: "RSS", icon: siRss },
];

function Row({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center gap-24 pr-24"
    >
      {LOGOS.map(({ name, icon }) => (
        <li key={name}>
          <svg
            role={hidden ? undefined : "img"}
            aria-label={hidden ? undefined : name}
            viewBox="0 0 24 24"
            className="size-14 shrink-0 fill-white opacity-90 transition-all duration-300 hover:scale-110 hover:opacity-100"
          >
            <path d={icon.path} />
          </svg>
        </li>
      ))}
    </ul>
  );
}

/** Logos of the data sources, scrolling left forever (pure CSS; paused on hover). */
export function LogoMarquee({ label }: { label: string }) {
  return (
    <div className="space-y-8 border-y py-12">
      <p className="text-muted-foreground text-center text-[16.25px]">
        {label}
      </p>
      <div className="mask-fade-x group overflow-hidden">
        <div className="animate-marquee flex w-max group-hover:[animation-play-state:paused]">
          <Row />
          <Row hidden />
        </div>
      </div>
    </div>
  );
}

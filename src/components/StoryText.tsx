import type { CSSProperties } from 'react';
import type { StoryRun } from '../data/types.ts';

/** Body of one story card: plain runs, links tinted with the accent, and spacers. */
export function StoryText({ runs, accent }: { runs: StoryRun[]; accent: string }) {
  return (
    <p className="text-left text-[17px] lowercase leading-[1.6] tracking-[-0.008em] text-[#1f1f23]">
      {runs.map((run, i) =>
        run.br ? (
          <span key={i} aria-hidden className="block h-2" />
        ) : run.href ? (
          <a
            key={i}
            href={run.href}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto underline underline-offset-2 transition-colors hover:text-[color:var(--acc)]"
            style={{ '--acc': accent, textDecorationColor: accent } as CSSProperties}
          >
            {run.t}
          </a>
        ) : (
          <span key={i}>{run.t}</span>
        ),
      )}
    </p>
  );
}

import { motion } from 'motion/react';
import { useMemo } from 'react';
import { stories } from '../data/gallery.ts';
import { textColorOn } from '../lib/color.ts';
import { StoryText } from './StoryText.tsx';

const FADE_MASK =
  'linear-gradient(to bottom, transparent, black 110px, black calc(100% - 110px), transparent)';

const ABOUT_LINKS: [label: string, href: string][] = [
  ['commons', 'https://commons.wikimedia.org/wiki/Category:PD-Art_(PD-old-auto)'],
  ['sources', '/credits'],
];

/** Scrollable column of story cards shown in the `about` view (newest story first). */
export function StoryOverlay() {
  const ordered = useMemo(() => [...stories].reverse(), []);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div
        className="pointer-events-auto max-h-[calc(100%-48px)] w-[min(600px,calc(100vw-72px))] overflow-y-auto overflow-x-hidden px-1 pb-28 pt-28 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
      >
        {ordered.map((story, i) => {
          const color = story.color;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 28, delay: 0.25 + 0.08 * i }}
              className="mb-8"
            >
              <span
                className="block w-fit max-w-full truncate whitespace-nowrap px-1.5 py-0.5 font-mono text-[10px] leading-tight"
                style={{ background: color, color: textColorOn(color) }}
              >
                {story.label}
                {' · '}
                {story.years}
                {' · '}
                {story.city}
              </span>
              <div className="px-3.5 py-2.5" style={{ border: `1px solid ${color}` }}>
                <StoryText runs={story.runs} accent={color} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/** "commons" and "sources" links at the bottom of the `about` view. */
export function AboutLinks() {
  return (
    <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-6">
      {ABOUT_LINKS.map(([label, href], i) => (
        <motion.a
          key={label}
          href={href}
          target={href.startsWith('/') ? undefined : '_blank'}
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 26, delay: 0.6 + 0.07 * i }}
          className="artorb-nav-link text-[17px] lowercase leading-none text-black/45 transition-colors duration-200 hover:text-black"
        >
          {label}
        </motion.a>
      ))}
    </div>
  );
}

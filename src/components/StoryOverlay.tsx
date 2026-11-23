import { motion } from 'motion/react';
import { stories } from '../data/gallery.ts';
import { textColorOn } from '../lib/color.ts';

const FADE_MASK =
  'linear-gradient(to bottom, transparent, black 110px, black calc(100% - 110px), transparent)';

/** The intro is last in `data/stories.json` and shown first. */
const ORDERED = [...stories].reverse();

/** Scrollable column of story cards shown in the `about` view. */
export function StoryOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div
        className="pointer-events-auto max-h-[calc(100%-48px)] w-[min(600px,calc(100vw-72px))] overflow-y-auto overflow-x-hidden px-1 pb-28 pt-28 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
      >
        {ORDERED.map((story, i) => (
          <motion.div
            key={story.label}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 28, delay: 0.25 + 0.08 * i }}
            className="mb-8"
          >
            <span
              className="block w-fit max-w-full truncate whitespace-nowrap px-1.5 py-0.5 font-mono text-[10px] leading-tight"
              style={{ background: story.color, color: textColorOn(story.color) }}
            >
              {story.label}
              {' · '}
              {story.years}
              {' · '}
              {story.byline}
            </span>
            <p
              className="px-3.5 py-2.5 text-left text-[17px] leading-[1.6] tracking-[-0.008em] text-[#1f1f23]"
              style={{ border: `1px solid ${story.color}` }}
            >
              {story.text}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/** Link to the image credits at the bottom of the `about` view. */
export function AboutLinks() {
  return (
    <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
      <motion.a
        href="/credits"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26, delay: 0.6 }}
        className="artorb-nav-link whitespace-nowrap text-[17px] leading-none text-black/60 transition-colors duration-200 hover:text-black"
      >
        图片来源
      </motion.a>
    </div>
  );
}

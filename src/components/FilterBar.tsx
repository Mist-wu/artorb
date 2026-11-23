import { motion } from 'motion/react';
import { FILTERS, LABELS, type FilterId } from '../data/views.ts';

interface FilterBarProps {
  visible: boolean;
  shownBefore: boolean;
  filter: FilterId;
  onSelect(filter: FilterId): void;
}

/** Bottom-right `全部 / 绘画 / 版画` switch. */
export function FilterBar({ visible, shownBefore, filter, onSelect }: FilterBarProps) {
  return (
    <div
      inert={!visible}
      style={{ pointerEvents: visible ? undefined : 'none' }}
      className="absolute bottom-3.5 right-[30px] z-20 flex h-9 items-center gap-6 sm:bottom-5 sm:right-6"
    >
      {FILTERS.map((f, i) => (
        <motion.button
          key={f}
          onClick={() => onSelect(f)}
          whileTap={{ scale: 0.92 }}
          initial={false}
          animate={{ opacity: +!!visible, y: 14 * Number(!visible) }}
          transition={
            visible
              ? {
                  type: 'spring',
                  stiffness: 240,
                  damping: 26,
                  delay: (shownBefore ? 0.22 : 0.55) + 0.07 * i,
                }
              : { duration: 0.14, delay: (FILTERS.length - 1 - i) * 0.025 }
          }
          aria-pressed={filter === f}
          className={`cursor-pointer text-[17px] lowercase leading-none transition-colors duration-200 ${filter === f ? 'text-black/85' : 'text-black/60 hover:text-black'}`}
        >
          {LABELS[f]}
        </motion.button>
      ))}
    </div>
  );
}

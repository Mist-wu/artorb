import { AnimatePresence, motion } from 'motion/react';

/** Text whose letters roll in one by one when it changes. */
export function AnimatedText({ text }: { text: string }) {
  return (
    <span className="inline-flex overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        {text.split('').map((char, i) => (
          <motion.span
            key={`${char}-${i}`}
            initial={{ opacity: 0, y: 11 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { type: 'spring', stiffness: 420, damping: 38, delay: 0.018 * i },
            }}
            exit={{ opacity: 0, y: -11, transition: { duration: 0.13, delay: 0.012 * i } }}
            className="inline-block whitespace-pre"
          >
            {char}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

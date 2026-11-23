import { AnimatePresence, motion } from 'motion/react';
import type { Ref } from 'react';
import { LABELS, SHAPES, type Shape } from '../data/views.ts';
import { CaretLeftIcon, CaretRightIcon } from './icons.tsx';

const SNAPPY_SPRING = { type: 'spring', stiffness: 480, damping: 30, mass: 0.8 } as const;

interface ShapePagerProps {
  menuRef: Ref<HTMLDivElement>;
  visible: boolean;
  menuOpen: boolean;
  setMenuOpen(open: boolean): void;
  shapeIndex: number;
  /** Direction of the last step (+1 / -1), drives the label slide. */
  direction: number;
  step(direction: number): void;
  selectShape(shape: Shape): void;
}

/** Bottom-left `‹ 球体 ›` pager; clicking the label opens the full list. */
export function ShapePager({
  menuRef,
  visible,
  menuOpen,
  setMenuOpen,
  shapeIndex,
  direction,
  step,
  selectShape,
}: ShapePagerProps) {
  return (
    <div
      ref={menuRef}
      inert={!visible}
      className="absolute bottom-3.5 left-[30px] z-20 sm:bottom-5 sm:left-6"
    >
      <motion.div
        initial={false}
        animate={{ opacity: +!!visible, y: 22 * Number(!visible) }}
        transition={
          visible
            ? { type: 'spring', stiffness: 210, damping: 26, delay: 0.05 }
            : { duration: 0.2 }
        }
        className="flex h-9 items-center text-[17px] lowercase leading-none"
      >
        <AnimatePresence mode="wait" initial={false}>
          {menuOpen ? (
            <motion.div key="list" className="flex items-center gap-4 px-1">
              {SHAPES.map((shape, i) => (
                <motion.button
                  key={shape}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { ...SNAPPY_SPRING, delay: 0.035 * i } }}
                  exit={{
                    opacity: 0,
                    y: 4,
                    transition: { duration: 0.12, delay: (SHAPES.length - 1 - i) * 0.018 },
                  }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    selectShape(shape);
                    setMenuOpen(false);
                  }}
                  aria-pressed={shape === SHAPES[shapeIndex]}
                  className={`cursor-pointer transition-colors duration-200 ${shape === SHAPES[shapeIndex] ? 'text-black/85' : 'text-black/60 hover:text-black'}`}
                >
                  {LABELS[shape]}
                </motion.button>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="pager"
              className="flex items-center"
              initial={{ opacity: 0, y: 6 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { type: 'spring', stiffness: 170, damping: 24 },
              }}
              exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
            >
              <motion.button
                onClick={() => step(-1)}
                aria-label="上一个形状"
                whileHover={{ scale: 1.2, x: -2 }}
                whileTap={{ scale: 0.8 }}
                transition={SNAPPY_SPRING}
                className="-ml-[5px] grid h-8 w-8 cursor-pointer place-items-center text-black/60 transition-colors hover:text-black"
              >
                <CaretLeftIcon size={15} />
              </motion.button>
              <button
                onClick={() => setMenuOpen(true)}
                aria-label={`选择形状，当前为${LABELS[SHAPES[shapeIndex]]}`}
                className="relative block h-[20px] w-[64px] cursor-pointer overflow-hidden text-center text-black/85"
              >
                <AnimatePresence initial={false} custom={direction}>
                  <motion.span
                    key={SHAPES[shapeIndex]}
                    custom={direction}
                    variants={{
                      enter: (d: number) => ({ x: 22 * d, opacity: 0 }),
                      center: { x: 0, opacity: 1 },
                      exit: (d: number) => ({ x: -22 * d, opacity: 0 }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={SNAPPY_SPRING}
                    className="absolute inset-0"
                  >
                    {LABELS[SHAPES[shapeIndex]]}
                  </motion.span>
                </AnimatePresence>
              </button>
              <motion.button
                onClick={() => step(1)}
                aria-label="下一个形状"
                whileHover={{ scale: 1.2, x: 2 }}
                whileTap={{ scale: 0.8 }}
                transition={SNAPPY_SPRING}
                className="grid h-8 w-8 cursor-pointer place-items-center text-black/60 transition-colors hover:text-black"
              >
                <CaretRightIcon size={15} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

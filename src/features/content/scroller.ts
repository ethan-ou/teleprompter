import { useContentStore } from "@/features/content/store";
import { useNavbarStore } from "@/features/navbar/store";
import { useTrackerStore } from "@/features/tracker/store";
import { scroll } from "@/lib/smooth-scroll";
import { getNextWordIndex } from "@/lib/word-tokenizer";

// Duration (ms) of the scroll after a manual jump, shorter than the default so it feels responsive
const JUMP_SCROLL_DURATION = 300;

// Controller for the in-flight scroll animation, or null when idle
let active: AbortController | null = null;

export const isScrolling = () => active !== null;

/**
 * Window scroll offset that puts the word after `index` at the reading line for the current alignment.
 * Token positions don't depend on highlighting, so this is valid before React re-renders.
 */
const getScrollTop = (index: number) => {
  if (index <= 0) {
    return 0;
  }

  const { tokens } = useContentStore.getState();
  const { fontSize, align } = useNavbarStore.getState();
  const target = Math.min(getNextWordIndex(tokens, index), tokens.length - 1);
  const element = document.querySelector<HTMLElement>(`[data-token-index="${target}"]`);

  if (!element) {
    return 0;
  }

  const viewportHeight = document.documentElement.clientHeight;
  return {
    top: element.offsetTop,
    center: element.offsetTop - viewportHeight / 2 + fontSize * 2,
    bottom: element.offsetTop - (3 / 4) * viewportHeight + fontSize * 2,
  }[align];
};

/**
 * Smooth scroll to the token at `index`. A newer scroll always wins: any in-flight animation is
 * stopped and the new one starts from wherever it got to.
 */
export async function scrollToToken(index: number, duration?: number) {
  active?.abort();
  const controller = new AbortController();
  active = controller;

  try {
    await scroll({ top: getScrollTop(index), behavior: "smooth", duration, signal: controller.signal });
  } finally {
    if (active === controller) {
      active = null;
    }
  }
}

/**
 * Manual jump (arrow keys, clicking a word, reset): move the tracker and scroll there right away,
 * rather than waiting for the next periodic scroll.
 */
export function jumpTo(index: number) {
  useTrackerStore.getState().seek(index);
  return scrollToToken(index, JUMP_SCROLL_DURATION);
}

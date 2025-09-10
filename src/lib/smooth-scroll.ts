/**
 * Ease in-out quad - gentle acceleration and deceleration
 * @param t - progress from 0 to 1
 */
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Smooth scroll (replacement for window.scroll with duration support)
 *
 * Usage:
 * scroll({ left: 0, top: 500, duration: 1000, behavior: 'smooth' })
 */
export function scroll(options: {
  left?: number;
  top?: number;
  behavior?: "auto" | "smooth";
  duration?: number;
}): Promise<void> {
  const x = options.left ?? 0;
  const y = options.top ?? 0;
  const duration = options.duration ?? 750;

  if (options.behavior === "auto") {
    window.scrollTo(x, y);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const startX = window.pageXOffset;
    const startY = window.pageYOffset;
    const distanceX = x - startX;
    const distanceY = y - startY;

    let startTime: number | null = null;

    const animate = (currentTime: number) => {
      if (!startTime) {
        startTime = currentTime;
      }

      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      const easedProgress = easeInOutQuad(progress);

      const currentX = startX + distanceX * easedProgress;
      const currentY = startY + distanceY * easedProgress;

      window.scrollTo(currentX, currentY);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(animate);
  });
}

import { useEffect, useRef, useState } from "react";

import type { RefObject } from "react";

export type ElementSize = {
  width: number | undefined;
  height: number | undefined;
};

type UseResizeObserverOptions<T extends HTMLElement = HTMLElement> = {
  ref: RefObject<T>;
  onResize?: (size: ElementSize) => void;
  box?: "border-box" | "content-box" | "device-pixel-content-box";
};

const initialSize: ElementSize = {
  width: undefined,
  height: undefined,
};

export function useResizeObserver<T extends HTMLElement = HTMLElement>(
  options: UseResizeObserverOptions<T>,
): ElementSize {
  const { ref, box = "content-box" } = options;
  const [{ width, height }, setSize] = useState<ElementSize>(initialSize);
  const previousSize = useRef<ElementSize>({ ...initialSize });
  const onResize = useRef<((size: ElementSize) => void) | undefined>(undefined);
  onResize.current = options.onResize;

  useEffect(() => {
    if (!ref.current) return;

    if (typeof window === "undefined" || !("ResizeObserver" in window)) return;

    const observer = new ResizeObserver(([entry]) => {
      const boxProp =
        box === "border-box"
          ? "borderBoxSize"
          : box === "device-pixel-content-box"
            ? "devicePixelContentBoxSize"
            : "contentBoxSize";

      const newWidth = extractSize(entry, boxProp, "inlineSize");
      const newHeight = extractSize(entry, boxProp, "blockSize");

      const hasChanged =
        previousSize.current.width !== newWidth || previousSize.current.height !== newHeight;

      if (hasChanged) {
        const newSize: ElementSize = { width: newWidth, height: newHeight };
        previousSize.current.width = newWidth;
        previousSize.current.height = newHeight;

        if (onResize.current) {
          onResize.current(newSize);
        } else {
          setSize(newSize);
        }
      }
    });

    observer.observe(ref.current, { box });

    return () => {
      observer.disconnect();
    };
  }, [box, ref]);

  return { width, height };
}

type BoxSizesKey = keyof Pick<
  ResizeObserverEntry,
  "borderBoxSize" | "contentBoxSize" | "devicePixelContentBoxSize"
>;

function extractSize(
  entry: ResizeObserverEntry,
  box: BoxSizesKey,
  sizeType: keyof ResizeObserverSize,
): number | undefined {
  if (!entry[box]) {
    if (box === "contentBoxSize") {
      return entry.contentRect[sizeType === "inlineSize" ? "width" : "height"];
    }
    return undefined;
  }

  return Array.isArray(entry[box])
    ? entry[box][0][sizeType]
    : // @ts-ignore Support Firefox's non-standard behavior
      (entry[box][sizeType] as number);
}

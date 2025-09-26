export type ElementSize = {
  width: number | undefined;
  height: number | undefined;
};

type UseResizeObserverOptions = {
  onResize?: (size: ElementSize) => void;
  box?: "border-box" | "content-box" | "device-pixel-content-box";
};

const initialSize: ElementSize = {
  width: undefined,
  height: undefined,
};

export function createResizeObserver(options: UseResizeObserverOptions = {}) {
  const { box = "content-box", onResize } = options;
  
  let size = $state<ElementSize>({ ...initialSize });
  let previousSize = { ...initialSize };

  function resizeAction(node: HTMLElement) {
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
        previousSize.width !== newWidth || previousSize.height !== newHeight;

      if (hasChanged) {
        const newSize: ElementSize = { width: newWidth, height: newHeight };
        previousSize = { ...newSize };

        if (onResize) {
          onResize(newSize);
        } else {
          size = newSize;
        }
      }
    });

    observer.observe(node, { box });

    return {
      destroy() {
        observer.disconnect();
      }
    };
  }

  return {
    action: resizeAction,
    get size() {
      return size;
    }
  };
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
import { useEffect, useRef, useState } from "react";
import { useScreenCapture } from "@/app/screen-capture";
import { useNavbarStore } from "../navbar/store";
import { useResizeObserver } from "@/app/resize-observer";

export function Capture() {
  const documentRef = useRef<HTMLElement>(document.documentElement);
  const { cast, setCast } = useNavbarStore((state) => state);
  const { start, stop, ref, running } = useScreenCapture();
  const [height, setHeight] = useState<number>(0);

  useEffect(() => {
    if (cast && !running) start(setCast, () => setCast(false));
    if (!cast && running) stop();
  }, [cast]);

  // Resize the video element to always be 100vh minus the navbar
  // or any elements above the capture window.
  useResizeObserver({
    ref: documentRef,
    onResize: () => {
      if (ref.current) {
        setHeight(() =>
          ref.current
            ? Array.from(ref.current.getClientRects()).reduce(
                (accum, curr) => accum + curr.y,
                0,
              )
            : 0,
        );
      }
    },
  });

  return (
    <video
      ref={ref}
      className="fixed z-0 w-screen overflow-hidden bg-neutral-950 opacity-50"
      style={{
        height: `calc(100vh - ${height}px)`,
      }}
      autoPlay
    ></video>
  );
}

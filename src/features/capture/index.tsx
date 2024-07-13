import { useEffect, forwardRef } from "react";
import { useScreenCapture } from "@/app/screen-capture";
import { useNavbarStore } from "../navbar/store";

export const Capture = forwardRef<HTMLDivElement>((props, ref) => {
  const { cast, setCast } = useNavbarStore((state) => state);
  const {
    start: captureStart,
    stop: captureStop,
    ref: videoRef,
    running: captureRunning,
  } = useScreenCapture();

  useEffect(() => {
    if (cast && !captureRunning) captureStart(setCast);
    if (!cast && captureRunning) captureStop();
  }, [cast]);

  return (
    <div ref={ref} className="fixed size-full">
      <video
        ref={videoRef}
        className="z-0 bg-transparent opacity-50"
        style={{ height: "inherit", width: "inherit" }}
        autoPlay
      ></video>
    </div>
  );
});

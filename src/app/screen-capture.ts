import { useRef } from "react";

export function useScreenCapture() {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  return {
    start: (callback?: (success: boolean) => void) => {
      startCapture().then((stream) => {
        if (stream && videoElementRef.current) {
          videoElementRef.current.srcObject = stream;
          return callback ? callback(true) : undefined;
        }

        return callback ? callback(false) : undefined;
      });
    },
    stop: () => {
      if (videoElementRef.current) {
        stopCapture(videoElementRef.current);
      }
    },
    running: videoElementRef.current ? videoElementRef.current.srcObject !== null : false,
    ref: videoElementRef,
  };
}

export async function startCapture() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    return stream;
  } catch (error) {
    if (error instanceof Error) {
      alert(error.message);
    }
    return null;
  }
}

export function stopCapture(element: HTMLVideoElement) {
  const src = element.srcObject as MediaStream | null;
  if (src && src.getTracks) {
    src.getTracks().forEach((track) => track.stop());
    element.srcObject = null;
  }
}

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

export const useFullScreen = () => {
  const [active, setActive] = useState<boolean>(false);
  const node = useRef<HTMLElement>(document.getElementById("root")!);

  useEffect(() => {
    const handleChange = () => {
      setActive(document.fullscreenElement === node.current);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const enter = useCallback(() => {
    if (document.fullscreenElement) {
      return document.exitFullscreen().then(() => {
        return node.current.requestFullscreen();
      });
    } else if (node.current) {
      return node.current.requestFullscreen();
    }
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement === node.current) {
      return document.exitFullscreen();
    }
    return Promise.resolve();
  }, []);

  return useMemo(
    () => ({
      active,
      enter,
      exit,
      node,
    }),
    [active, enter, exit]
  );
};

export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  // Remember the latest callback if it changes.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    // Don't schedule if no delay is specified.
    // Note: 0 is a valid value for delay.
    if (delay === null) {
      return;
    }

    const id = setInterval(() => {
      savedCallback.current();
    }, delay);

    return () => {
      clearInterval(id);
    };
  }, [delay]);
}

import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from "react";

export const useFullScreen = (onChange?: (active: boolean) => void) => {
  const [active, setActive] = useState<boolean>(false);
  const node = useRef<HTMLElement>(document.documentElement);

  useEffect(() => {
    const handleChange = () => {
      setActive(document.fullscreenElement === node.current);
      onChange && onChange(document.fullscreenElement === node.current);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const enter = useCallback(() => {
    const keyboardLock = () => {
      if ("keyboard" in navigator && "lock" in navigator.keyboard) {
        navigator.keyboard.lock(["Escape"]);
      }
    };

    if (document.fullscreenElement) {
      return document
        .exitFullscreen()
        .then(() => node.current.requestFullscreen())
        .then(() => keyboardLock());
    } else if (node.current) {
      return node.current.requestFullscreen().then(() => keyboardLock());
    }
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement === node.current) {
      return document.exitFullscreen().then(() => navigator.keyboard.unlock());
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
    [active, enter, exit],
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

export function useLayoutEffectInterval(callback: () => void, delay: number | null) {
  useLayoutEffect(() => {
    if (delay === null) {
      callback();
    }
  });

  useInterval(callback, delay);
}

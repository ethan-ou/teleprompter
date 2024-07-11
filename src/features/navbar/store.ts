import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NavbarState {
  status: "editing" | "started" | "stopped";
  horizontallyFlipped: boolean;
  verticallyFlipped: boolean;
  fontSize: number;
  margin: number;
  opacity: number;
  timer: number;
  align: "top" | "center";
}

export interface NavbarActions {
  toggleEdit: () => void;
  start: () => void;
  stop: () => void;
  flipHorizontally: () => void;
  flipVertically: () => void;
  setFontSize: (value: number) => void;
  setMargin: (value: number) => void;
  setOpacity: (value: number) => void;
  incrementTimer: () => void;
  resetTimer: () => void;
  setAlign: (value: "top" | "center") => void;
}

export const useNavbarStore = create<NavbarState & NavbarActions>()(
  persist(
    (set) => ({
      status: "stopped",
      horizontallyFlipped: false,
      verticallyFlipped: false,
      fontSize: 60,
      margin: 10,
      opacity: 80,
      timer: 0,
      align: "top",
      toggleEdit: () =>
        set((state) => ({
          status: state.status === "editing" ? "stopped" : "editing",
        })),
      start: () => set(() => ({ status: "started" })),
      stop: () => set(() => ({ status: "stopped" })),
      flipHorizontally: () => set((state) => ({ horizontallyFlipped: !state.horizontallyFlipped })),
      flipVertically: () => set((state) => ({ verticallyFlipped: !state.verticallyFlipped })),
      setFontSize: (value: number) => set(() => ({ fontSize: value })),
      setMargin: (value: number) => set(() => ({ margin: value })),
      setOpacity: (value: number) => set(() => ({ opacity: value })),
      incrementTimer: () => set((state) => ({ timer: state.timer + 1 })),
      resetTimer: () => set(() => ({ timer: 0 })),
      setAlign: (value: "top" | "center") => set(() => ({ align: value })),
    }),
    {
      name: "navbar",
      partialize: (state) => ({
        horizontallyFlipped: state.horizontallyFlipped,
        verticallyFlipped: state.verticallyFlipped,
        fontSize: state.fontSize,
        margin: state.margin,
        opacity: state.opacity,
        align: state.align,
      }),
    },
  ),
);

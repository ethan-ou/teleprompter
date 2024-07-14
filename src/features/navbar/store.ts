import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Status = "editing" | "started" | "stopped";
export type Align = "top" | "center" | "bottom";

export interface NavbarState {
  status: Status;
  mirror: boolean;
  hide: boolean;
  fontSize: number;
  margin: number;
  opacity: number;
  timer: number;
  cast: boolean;
  align: Align;
}

export interface NavbarActions {
  toggleEdit: () => void;
  start: () => void;
  stop: () => void;
  toggleMirror: () => void;
  toggleHide: () => void;
  setCast: (value: boolean) => void;
  setFontSize: (value: number) => void;
  setMargin: (value: number) => void;
  setOpacity: (value: number) => void;
  incrementTimer: () => void;
  resetTimer: () => void;
  setAlign: (value: Align) => void;
}

export const useNavbarStore = create<NavbarState & NavbarActions>()(
  persist(
    (set) => ({
      status: "stopped",
      mirror: false,
      hide: false,
      fontSize: 60,
      margin: 10,
      opacity: 80,
      timer: 0,
      cast: false,
      align: "top",
      toggleEdit: () =>
        set((state) => ({
          status: state.status === "editing" ? "stopped" : "editing",
        })),
      toggleHide: () => set((state) => ({ hide: !state.hide })),
      setCast: (value: boolean) => set(() => ({ cast: value })),
      start: () => set(() => ({ status: "started" })),
      stop: () => set(() => ({ status: "stopped" })),
      toggleMirror: () => set((state) => ({ mirror: !state.mirror })),
      setFontSize: (value: number) => set(() => ({ fontSize: value })),
      setMargin: (value: number) => set(() => ({ margin: value })),
      setOpacity: (value: number) => set(() => ({ opacity: value })),
      incrementTimer: () => set((state) => ({ timer: state.timer + 1 })),
      resetTimer: () => set(() => ({ timer: 0 })),
      setAlign: (value: Align) => set(() => ({ align: value })),
    }),
    {
      name: "navbar",
      partialize: (state) => ({
        mirror: state.mirror,
        hide: state.hide,
        fontSize: state.fontSize,
        margin: state.margin,
        opacity: state.opacity,
        align: state.align,
      }),
    },
  ),
);

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
  collaborate: boolean;
}

export interface navbarStore {
  start: () => void;
  stop: () => void;
  toggleEdit: () => void;
  toggleMirror: () => void;
  setHide: (value: boolean) => void;
  setCast: (value: boolean) => void;
  setFontSize: (value: number) => void;
  setMargin: (value: number) => void;
  setOpacity: (value: number) => void;
  incrementTimer: () => void;
  resetTimer: () => void;
  setAlign: (value: Align) => void;
  setCollaborate: (value: boolean) => void;
}

export const useNavbarStore = create<NavbarState & navbarStore>()(
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
      collaborate: false,
      toggleEdit: () =>
        set((state) => ({
          status: state.status === "editing" ? "stopped" : "editing",
        })),
      setHide: (value: boolean) => set(() => ({ hide: value })),
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
      setCollaborate: (value: boolean) => set(() => ({ collaborate: value })),
    }),
    {
      name: "teleprompter:settings",
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

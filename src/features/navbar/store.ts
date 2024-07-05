import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NavbarState {
  status: "editing" | "started" | "stopped";
  horizontallyFlipped: boolean;
  verticallyFlipped: boolean;
  fontSize: number;
  margin: number;
  opacity: number;
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
}

export const useNavbarStore = create<NavbarState & NavbarActions>()(
  persist(
    (set) => ({
      status: "stopped",
      horizontallyFlipped: false,
      verticallyFlipped: false,
      fontSize: 30,
      margin: 10,
      opacity: 80,
      toggleEdit: () =>
        set((state) => ({ status: state.status === "editing" ? "stopped" : "editing" })),
      start: () => set(() => ({ status: "started" })),
      stop: () => set(() => ({ status: "stopped" })),
      flipHorizontally: () => set((state) => ({ horizontallyFlipped: !state.horizontallyFlipped })),
      flipVertically: () => set((state) => ({ verticallyFlipped: !state.verticallyFlipped })),
      setFontSize: (value: number) => set(() => ({ fontSize: value })),
      setMargin: (value: number) => set(() => ({ margin: value })),
      setOpacity: (value: number) => set(() => ({ opacity: value })),
    }),
    {
      name: "navbar",
      partialize: (state) => ({
        horizontallyFlipped: state.horizontallyFlipped,
        verticallyFlipped: state.verticallyFlipped,
        fontSize: state.fontSize,
        margin: state.margin,
        opacity: state.opacity,
      }),
    }
  )
);

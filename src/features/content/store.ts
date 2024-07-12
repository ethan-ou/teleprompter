import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Token, tokenize } from "@/lib/word-tokenizer";

export type Position = {
  start: number;
  search: number;
  end: number;
  bounds: number;
};

export interface ContentState {
  rawText: string;
  tokens: Token[];
  position: Position;
}

export interface ContentActions {
  setContent: (text: string) => void;
  setTokens: () => void;
  setPosition: (position: Partial<Position>) => void;
  resetPosition: () => void;
}

const initialText = 'Click on the "Edit" button and paste your content here...';

export const useContentStore = create<ContentState & ContentActions>()(
  persist(
    (set) => ({
      rawText: initialText,
      tokens: tokenize(initialText),
      position: {
        start: -1,
        search: -1,
        end: -1,
        bounds: -1,
      },
      setContent: (text: string) =>
        set(() => ({
          rawText: text,
          start: -1,
          search: -1,
          end: -1,
          bounds: -1,
        })),
      setTokens: () => set((state) => ({ tokens: tokenize(state.rawText) })),
      setPosition: (position) => set((prev) => ({ position: { ...prev.position, ...position } })),
      resetPosition: () =>
        set(() => ({ position: { start: -1, search: -1, end: -1, bounds: -1 } })),
    }),
    {
      name: "content",
      partialize: (state) => ({ rawText: state.rawText }),
      onRehydrateStorage: () => (state, error) => !error && state && state.setTokens(),
    },
  ),
);

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type TextElement, tokenize } from "@/lib/word-tokenizer";

export interface ContentState {
  rawText: string;
  textElements: TextElement[];
  start: number;
  end: number;
}

export interface ContentActions {
  setContent: (text: string) => void;
  setTextElements: () => void;
  setStart: (index: number) => void;
  setEnd: (index: number) => void;
  resetPosition: () => void;
}

const initialText = 'Click on the "Edit" button and paste your content here...';

export const useContentStore = create<ContentState & ContentActions>()(
  persist(
    (set) => ({
      rawText: initialText,
      textElements: tokenize(initialText),
      start: -1,
      end: -1,
      setContent: (text: string) =>
        set(() => ({
          rawText: text,
          start: -1,
          end: -1,
        })),
      setTextElements: () =>
        set((state) => ({ textElements: tokenize(state.rawText) })),
      setStart: (index: number) => set(() => ({ start: index })),
      setEnd: (index: number) => set(() => ({ end: index })),
      resetPosition: () => set(() => ({ start: -1, end: -1 })),
    }),
    {
      name: "content",
      partialize: (state) => ({ rawText: state.rawText }),
      onRehydrateStorage: () => (state, error) =>
        !error && state && state.setTextElements(),
    },
  ),
);

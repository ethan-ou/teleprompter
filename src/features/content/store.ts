import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type TextElement, tokenize } from "@/lib/word-tokenizer";

export interface ContentState {
  rawText: string;
  textElements: TextElement[];
  finalTranscriptIndex: number;
  interimTranscriptIndex: number;
}

export interface ContentActions {
  setContent: (text: string) => void;
  setTextElements: () => void;
  setInterimTranscriptIndex: (index: number) => void;
  setFinalTranscriptIndex: (index: number) => void;
  resetTranscriptionIndices: () => void;
}

const initialText = 'Click on the "Edit" button and paste your content here...';

export const useContentStore = create<ContentState & ContentActions>()(
  persist(
    (set) => ({
      rawText: initialText,
      textElements: tokenize(initialText),
      interimTranscriptIndex: -1,
      finalTranscriptIndex: -1,
      setContent: (text: string) =>
        set(() => ({ rawText: text, interimTranscriptIndex: -1, finalTranscriptIndex: -1 })),
      setTextElements: () => set((state) => ({ textElements: tokenize(state.rawText) })),
      setInterimTranscriptIndex: (index: number) => set(() => ({ interimTranscriptIndex: index })),
      setFinalTranscriptIndex: (index: number) => set(() => ({ finalTranscriptIndex: index })),
      resetTranscriptionIndices: () =>
        set(() => ({ interimTranscriptIndex: -1, finalTranscriptIndex: -1 })),
    }),
    {
      name: "content",
      partialize: (state) => ({ rawText: state.rawText }),
      onRehydrateStorage: () => (state, error) => !error && state && state.setTextElements(),
    }
  )
);

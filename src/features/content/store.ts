import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Token, tokenize } from "@/lib/word-tokenizer";
import yjs from "@/lib/zustand-yjs";
import * as Y from "yjs";
import { TrysteroProvider } from "@/lib/y-webrtc-trystero";

export type Position = {
  start: number;
  search: number;
  end: number;
  bounds: number;
};

export interface ContentState {
  text: string;
  tokens: Token[];
  position: Position;
}

export interface ContentActions {
  setText: (text: string) => void;
  setTokens: () => void;
  setPosition: (position: Partial<Position>) => void;
}

const initialText = `This is a voice-activated teleprompter. To use it, press Start on the top-left and speak into your microphone.

As you speak, the transcript will highlight and scroll down the page. If you need to go off-script, you can do so and the teleprompter will only scroll if your speech begins to match the text again. [Try going off script]

To enter your own script, press the Edit button with the pencil icon in the menu. Hover over the other buttons to see what they do. To change the text size, margin and brightness, click or tap and drag the icons on the right of the screen. You can also set the alignment of the text on the far right.

Credits to jlecomte for creating the original version of this teleprompter.`;

const ROOM_ID = "23910jfsadid20";
const APP_ID = "voice-teleprompter-2193021";
const ydoc = new Y.Doc();
// Initialize Trystero room with optional password
// Note: Trystero always uses encryption, but you can add an additional password for room access
const provider1 = new TrysteroProvider(ROOM_ID, ydoc, {
  appId: APP_ID,
  maxConns: 5,
});

export const useContentStore = create<ContentState & ContentActions>()(
  persist(
    yjs(ydoc, "content", (set) => ({
      text: initialText,
      tokens: tokenize(initialText),
      position: {
        start: -1,
        search: -1,
        end: -1,
        bounds: -1,
      },
      setText: (text: string) =>
        set(() => ({
          text: text,
          start: -1,
          search: -1,
          end: -1,
          bounds: -1,
        })),
      setTokens: () => set((state) => ({ tokens: tokenize(state.text) })),
      setPosition: (position) => set((prev) => ({ position: { ...prev.position, ...position } })),
    })),
    {
      name: "teleprompter:content",
      partialize: (state) => ({ text: state.text }),
      onRehydrateStorage: () => (state, error) => !error && state && state.setTokens(),
    },
  ),
);

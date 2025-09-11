import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Token, tokenize } from "@/lib/word-tokenizer";
import { useCollaborateStore } from "@/features/collaborate/store";
import { useY } from "@/app/use-yjs";
import { Doc } from "yjs";

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

export const useLocalContentStore = create<ContentState & ContentActions>()(
  persist(
    (set) => ({
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
          tokens: tokenize(text),
          position: {
            start: -1,
            search: -1,
            end: -1,
            bounds: -1,
          },
        })),
      setTokens: () => set((state) => ({ tokens: tokenize(state.text) })),
      setPosition: (position) => set((prev) => ({ position: { ...prev.position, ...position } })),
    }),
    {
      name: "teleprompter:content",
      partialize: (state) => ({ text: state.text }),
      onRehydrateStorage: () => (state, error) => !error && state && state.setTokens(),
    },
  ),
);

/**
 * Content proxy hook that switches between local and room content
 *
 * Behavior:
 * - Room creators: Changes are saved to both room and local storage
 * - Room joiners: Changes are only proxied to the room, not saved locally
 * - When leaving a room, creators retain their content, joiners return to their original local content
 */
export function useContent() {
  const localStore = useLocalContentStore();
  const { ydoc, isCreator, isConnected } = useCollaborateStore();

  // Get the Y.Map only when in room
  const contentMap = isConnected() && ydoc ? ydoc.getMap("content") : null;

  // Use our custom Y.js hook for automatic subscription and re-rendering
  const roomContentData = useY(contentMap) as { text?: string; position?: Position } | null;

  // If in room, return room content with room actions
  if (isConnected() && ydoc && roomContentData) {
    const text = roomContentData?.text || "";
    const position = roomContentData?.position || defaultPosition;

    return {
      text,
      tokens: tokenize(text),
      position,
      ...createRoomContentActions(ydoc, contentMap, localStore, isCreator),
    };
  }

  return localStore;
}

const defaultPosition: Position = {
  start: -1,
  search: -1,
  end: -1,
  bounds: -1,
};

function createRoomContentActions(
  ydoc: Doc,
  contentMap: any,
  localStore: ContentState & ContentActions,
  isCreator: () => boolean,
) {
  return {
    setText: (text: string) => {
      ydoc.transact(() => {
        contentMap.set("text", text);
      });

      // Room creators also save to local storage
      if (isCreator()) {
        localStore.setText(text);
      }
    },
    setTokens: () => {}, // Tokens are computed from text
    setPosition: (position: Partial<Position>) => {
      ydoc.transact(() => {
        const currentPos = contentMap.get("position") || defaultPosition;
        contentMap.set("position", { ...currentPos, ...position });
      });

      // Room creators also save to local storage
      if (isCreator()) {
        localStore.setPosition(position);
      }
    },
  };
}

// Content accessor for non-React contexts
export function getContent() {
  const collaborate = useCollaborateStore.getState();
  const local = useLocalContentStore.getState();

  if (collaborate.isConnected() && collaborate.ydoc) {
    const contentMap = collaborate.ydoc.getMap("content");
    const text = (contentMap.get("text") as string) || "";
    const position = (contentMap.get("position") as Position) || defaultPosition;

    return {
      tokens: tokenize(text),
      position,
      ...createRoomContentActions(collaborate.ydoc, contentMap, local, collaborate.isCreator),
    };
  }

  return {
    tokens: local.tokens,
    position: local.position,
    setText: local.setText,
    setTokens: local.setTokens,
    setPosition: local.setPosition,
  };
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Token, tokenize } from "@/lib/word-tokenizer";
import { useEffect, useState } from "react";
import { useCollaborateStore } from "@/features/collaborate/store";

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
  const { status, ydoc, isRoomCreator } = useCollaborateStore();
  const [roomContent, setRoomContent] = useState<{
    text: string;
    position: Position;
  } | null>(null);

  // Determine if we're in room mode
  const isInRoom = status === "connected" && ydoc;

  useEffect(() => {
    if (!isInRoom || !ydoc) {
      setRoomContent(null);
      return;
    }

    const contentMap = ydoc.getMap("content");

    const updateRoomContent = () => {
      const text = contentMap.get("text") || "";
      const position = contentMap.get("position") || { start: -1, search: -1, end: -1, bounds: -1 };

      console.log("Updating room content:", { text, position }); // Debug log

      setRoomContent({
        text: typeof text === "string" ? text : "",
        position: position as Position,
      });
    };

    // Listen for changes first
    contentMap.observeDeep(updateRoomContent);

    // Handle initial room content based on creator status
    if (isRoomCreator) {
      console.log("Room creator - setting initial content:", localStore.text); // Debug log
      // Room creator: always populate room with their local content
      ydoc.transact(() => {
        contentMap.set("text", localStore.text);
        contentMap.set("position", localStore.position);
      });

      // The observer will fire and update roomContent, but we can also set it immediately
      setRoomContent({
        text: localStore.text,
        position: localStore.position,
      });
    } else {
      // Room joiner: just get existing content
      console.log("Room joiner - getting existing content"); // Debug log
      updateRoomContent();
    }

    return () => {
      contentMap.unobserveDeep(updateRoomContent);
    };
  }, [isInRoom, ydoc, isRoomCreator]); // Remove localStore dependencies!

  // If in room, return room content with room actions
  if (isInRoom && ydoc) {
    const currentContent = roomContent || {
      text: localStore.text,
      position: localStore.position,
    };

    return {
      text: currentContent.text,
      tokens: tokenize(currentContent.text), // Always compute tokens fresh
      position: currentContent.position,
      setText: (text: string) => {
        const contentMap = ydoc.getMap("content");
        const newPosition = { start: -1, search: -1, end: -1, bounds: -1 };
        ydoc.transact(() => {
          contentMap.set("text", text);
          contentMap.set("position", newPosition);
        });

        // If room creator, also save to local storage
        if (isRoomCreator) {
          localStore.setText(text);
        }
      },
      setTokens: () => {
        // Tokens are computed automatically, no need to store them in room
      },
      setPosition: (position: Partial<Position>) => {
        const contentMap = ydoc.getMap("content");
        ydoc.transact(() => {
          const currentPos = contentMap.get("position") || {
            start: -1,
            search: -1,
            end: -1,
            bounds: -1,
          };
          contentMap.set("position", { ...currentPos, ...position });
        });

        // If room creator, also save to local storage
        if (isRoomCreator) {
          localStore.setPosition(position);
        }
      },
    };
  }

  // Return local store when not in room
  return localStore;
}

// Global accessor for non-React contexts (like the recognizer)
// This will need to be kept in sync with the current content state
let globalContentAccessor: {
  getTokens: () => Token[];
  getPosition: () => Position;
  setPosition: (position: Partial<Position>) => void;
} | null = null;

export function setGlobalContentAccessor(accessor: typeof globalContentAccessor) {
  globalContentAccessor = accessor;
}

export function getGlobalContentState() {
  if (!globalContentAccessor) {
    throw new Error("Global content accessor not initialized");
  }
  return {
    tokens: globalContentAccessor.getTokens(),
    position: globalContentAccessor.getPosition(),
    setPosition: globalContentAccessor.setPosition,
  };
}

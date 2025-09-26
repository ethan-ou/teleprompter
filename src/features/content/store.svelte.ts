import { collaborateStore } from "@/features/collaborate/store.svelte";
// Use the custom localStore implementation
import { localStore } from "@/app/local-store.svelte";
import { tokenize, type Token } from "@/lib/word-tokenizer";

// --- Type Definitions ---
export type Position = {
  start: number;
  search: number;
  end: number;
  bounds: number;
};

// Define the type for the persistent state
interface PersistentContentState {
  text: string;
}

export interface ContentState {
  text: string;
  tokens: Token[];
  position: Position;
}

// --- Initial Constants ---
const initialText = `This is a voice-activated teleprompter. To use it, press Start on the top-left and speak into your microphone.

As you speak, the transcript will highlight and scroll down the page. If you need to go off-script, you can do so and the teleprompter will only scroll if your speech begins to match the text again. [Try going off script]

To enter your own script, press the Edit button with the pencil icon in the menu. Hover over the other buttons to see what they do. To change the text size, margin and brightness, click or tap and drag the icons on the right of the screen. You can also set the alignment of the text on the far right.

Credits to jlecomte for creating the original version of this teleprompter.`;

const defaultPosition: Position = {
  start: -1,
  search: -1,
  end: -1,
  bounds: -1,
};

const LOCAL_STORAGE_KEY = "teleprompter:content";

// --- Store Implementation ---

function createContentStore() {
  // Use a localStore instance for the text, which handles persistence automatically
  // Bug fix: Pass an object { text: ... } instead of just the string
  const localTextStore = localStore(LOCAL_STORAGE_KEY, { text: initialText });
  
  // Position is volatile, so we'll keep it as a simple state rune without persistence
  let localPosition = $state<Position>(defaultPosition);

  // --- Derived & Collaboration-Aware Public State ---

  /**
   * Determines the current text source: Yjs (if connected) or localText (if disconnected).
   */
  const text = $derived(() => {
    if (collaborateStore.isConnected && collaborateStore.ydoc) {
      const contentMap = collaborateStore.ydoc.getMap("content");
      // This is reactive: it will automatically update whenever the Ydoc changes
      return (contentMap.get("text") as string) || initialText;
    }
    // Access the value directly from the localStore instance and its `text` key
    return localTextStore.value.text;
  });

  /**
   * Tokens are always computed from the reactive 'text' derived property.
   */
  const tokens = $derived(() => {
    return tokenize(text());
  });

  /**
   * Determines the current position source: Yjs (if connected) or localPosition.
   */
  const position = $derived(() => {
    if (collaborateStore.isConnected && collaborateStore.ydoc) {
      const contentMap = collaborateStore.ydoc.getMap("content");
      return (contentMap.get("position") as Position) || defaultPosition;
    }
    return localPosition;
  });

  // --- Actions/Mutators ---

  /**
   * Sets the text, writing to Yjs if connected, or to local state otherwise.
   */
  function setText(newText: string) {
    if (collaborateStore.isConnected && collaborateStore.ydoc) {
      const contentMap = collaborateStore.ydoc.getMap("content");
      // Yjs transaction ensures atomic update
      collaborateStore.ydoc.transact(() => {
        contentMap.set("text", newText);
      });

      // Creator mirrors the text to local storage for persistence on next load
      if (collaborateStore.isCreator) {
        // Bug fix: update the local store with a full object
        localTextStore.value = { text: newText };
      }
    } else {
      // Local mode: mutate local store directly, which triggers its internal persistence effect
      // Bug fix: update the local store with a full object
      localTextStore.value = { text: newText };
    }
    // Always reset position on text change
    setPosition(defaultPosition);
  }

  /**
   * Sets the position, writing to Yjs if connected, or to local state otherwise.
   */
  function setPosition(newPosition: Partial<Position>) {
    if (collaborateStore.isConnected && collaborateStore.ydoc) {
      const contentMap = collaborateStore.ydoc.getMap("content");
      const currentPos = (contentMap.get("position") as Position) || defaultPosition;

      collaborateStore.ydoc.transact(() => {
        // Merge the new partial position with the current position
        contentMap.set("position", { ...currentPos, ...newPosition });
      });
    } else {
      // Local mode: mutate local state directly
      localPosition = { ...localPosition, ...newPosition };
    }
  }

  // --- Public Interface (Rune Store Getters) ---

  return {
    // Public derived state
    get text() {
      return text;
    },
    get tokens() {
      return tokens;
    },
    get position() {
      return position;
    },

    // Public actions
    setText,
    setPosition,
  };
}

export const contentStore = createContentStore();
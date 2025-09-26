import { tokenize, type Token } from "@/lib/word-tokenizer";
// Assuming this path correctly points to the collaborative store
import { collaborateStore } from "@/features/collaborate/store.svelte";

// --- Type Definitions ---

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

const LOCAL_STORAGE_KEY = 'teleprompter:content';

// --- Store Implementation ---

function createContentStore() {
    // Private state for local persistence/fallback mode
    let localText = $state(initialText);
    let localPosition = $state<Position>(defaultPosition);

    // --- Local Persistence Handlers ---

    function loadFromStorage() {
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    localText = parsed.text || initialText;
                    // Note: We don't store position, as it's typically volatile (reset on edit)
                } catch (e) {
                    console.warn('Failed to load content from localStorage:', e);
                }
            }
        }
    }

    function saveToStorage() {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ text: localText }));
        }
    }

    // Load initial state from storage immediately when the store is instantiated
    $effect.pre(() => {
        loadFromStorage();
    });

    // Auto-persist local text changes whenever localText is mutated
    $effect(() => {
        saveToStorage();
    });

    // --- Derived & Collaboration-Aware Public State ---

    /**
     * Determines the current text source: Yjs (if connected) or localText (if disconnected).
     */
    const text = $derived(() => {
        // Use isConnected from the external collaborateStore
        if (collaborateStore.isConnected && collaborateStore.ydoc) {
            // This is reactive: it will automatically update whenever the Ydoc changes
            const contentMap = collaborateStore.ydoc.getMap("content");
            // Check for ydoc, as it might be null during connection transitions
            return (contentMap.get("text") as string) || initialText;
        }
        return localText;
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
                localText = newText;
            }
        } else {
            // Local mode: mutate local state directly, which triggers $effect for persistence
            localText = newText;
        }
        // Always reset position on text change
        localText = newText; // ensure local text is updated even in creator mode
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

    /**
     * Re-tokenizes the current text. In the Svelte store, tokens are automatically 
     * derived from text, but this function is provided for compatibility.
     * Note: This is essentially a no-op since tokens are already reactive to text changes.
     */
    function setTokens() {
        // In the Svelte store, tokens are automatically derived from text,
        // so this function doesn't need to do anything explicit.
        // The tokens will automatically update when text changes.
        // This function is kept for API compatibility with the original store.
    }

    // --- Public Interface (Rune Store Getters) ---

    return {
        // Public derived state
        get text() { return text; },
        get tokens() { return tokens; },
        get position() { return position; },

        // Public actions
        setText,
        setPosition,
    };
}

export const contentStore = createContentStore();

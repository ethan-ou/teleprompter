import * as Y from "yjs";
// Assuming these imports are correctly typed in your project
import { TrysteroProvider } from "@/app/y-webrtc-trystero";
import { selfId } from "@/app/y-webrtc-trystero";
import type { Position } from "../content/store.svelte";
import { joinRoom as joinTrysteroRoom } from "trystero/mqtt";
import { generatePassphrase } from "@/lib/generate-passphrase";

const APP_ID = "voice-teleprompter-4DRPRcq3FJmdfwgHnKMOy";

/**
 * Defines the complete, centralized state structure for the collaboration store.
 */
interface CollaborateState {
    roomId: string | null;
    status: "disconnected" | "connected" | "error";
    provider: TrysteroProvider | null;
    ydoc: Y.Doc | null;
    creatorId: string | null;
}

function createCollaborateStore() {
    // 1. Centralize all state into a single $state object (the idiomatic "object-based" Rune Store)
    const state = $state<CollaborateState>({
        roomId: null,
        status: "disconnected",
        provider: null,
        ydoc: null,
        creatorId: null,
    });

    // 2. Define derived state referencing properties on the $state object
    const isCreator = $derived(state.creatorId === selfId);
    const isConnected = $derived(state.status === "connected");

    // --- Actions/Mutators ---

    /**
     * Resets the entire state to the disconnected defaults.
     */
    function resetState() {
        state.roomId = null;
        state.status = "disconnected";
        state.provider = null;
        state.ydoc = null;
        state.creatorId = null;
    }

    /**
     * Creates a new room, generating a unique ID and setting the current user as the creator.
     */
    async function createRoom(content: { text: string; position: Position }): Promise<string> {
        const newRoomId = generatePassphrase({
            capitalize: true,
            numWords: 3,
            wordSeparator: "",
        });

        // Mutate state directly on the object
        state.creatorId = selfId;
        await joinRoom(newRoomId, content);
        return newRoomId;
    }

    /**
     * Joins an existing room using a given ID.
     */
    async function joinRoom(
        newRoomId: string,
        content?: { text: string; position: Position },
    ): Promise<void> {
        if (state.roomId) {
            await leaveRoom();
            // Using an action here is more explicit about the flow
            throw new Error("Existing room found. The previous room was automatically left.");
        }

        try {
            const newYdoc = new Y.Doc();
            const newProvider = new TrysteroProvider(newRoomId, newYdoc, {
                trysteroRoom: joinTrysteroRoom({ appId: APP_ID }, newRoomId),
                maxConns: 10,
            });

            // Only initialize content if the caller provided it AND they are the creator
            if (content && isCreator) {
                const contentMap = newYdoc.getMap("content");
                newYdoc.transact(() => {
                    contentMap.set("text", content.text);
                    contentMap.set("position", content.position);
                });
            }

            // Update the single state object with all new resources
            state.provider = newProvider;
            state.ydoc = newYdoc;
            state.status = "connected";
            state.roomId = newRoomId;
        } catch (error) {
            console.error("Failed to join room:", error);
            // On error, reset the state entirely
            resetState();
            state.status = "error"; // Set the specific error status last
            throw error;
        }
    }

    /**
     * Cleans up YJS and Trystero resources and resets the state.
     */
    async function leaveRoom() {
        try {
            if (state.provider) {
                // Wait for Trystero to formally leave the room
                await state.provider.trystero.leave();
                state.provider.destroy();
            }
            if (state.ydoc) {
                state.ydoc.destroy();
            }
        } catch (error) {
            console.error("Error while cleaning up resources:", error);
        }

        // Final state reset
        resetState();
    }

    // 3. Return object exposing state properties via getters and public methods (actions)
    return {
        // Expose all properties from the centralized state object via getters
        get roomId() { return state.roomId; },
        get status() { return state.status; },
        get provider() { return state.provider; },
        get ydoc() { return state.ydoc; },
        get creatorId() { return state.creatorId; },

        // Expose derived properties
        get isCreator() { return isCreator; },
        get isConnected() { return isConnected; },

        // Expose actions
        createRoom,
        joinRoom,
        leaveRoom,
    };
}

export const collaborateStore = createCollaborateStore();

import { create } from "zustand";
import * as Y from "yjs";
import { TrysteroProvider } from "@/lib/y-webrtc-trystero";
import { Position } from "../content/store";

export interface RoomState {
  currentRoom: string | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  provider: TrysteroProvider | null;
  ydoc: Y.Doc | null;
  isRoomCreator: boolean;
}

export interface RoomActions {
  createRoom: (initialContent?: { text: string; position: Position }) => Promise<string>;
  joinRoom: (
    roomId: string,
    initialContent?: { text: string; position: Position },
  ) => Promise<void>;
  leaveRoom: () => void;
  getYDoc: () => Y.Doc | null;
}

const APP_ID = "voice-teleprompter-2193021";

export const useCollaborateStore = create<RoomState & RoomActions>()((set, get) => ({
  currentRoom: null,
  status: "disconnected",
  provider: null,
  ydoc: null,
  isRoomCreator: false,

  createRoom: async (initialContent?: { text: string; position: Position }): Promise<string> => {
    const roomId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set({ isRoomCreator: true });
    await get().joinRoom(roomId, initialContent);
    return roomId;
  },

  joinRoom: async (
    roomId: string,
    initialContent?: { text: string; position: Position },
  ): Promise<void> => {
    const state = get();

    // Leave current room if connected
    if (state.currentRoom) {
      state.leaveRoom();
    }

    set({
      status: "connecting",
      currentRoom: roomId,
      // DON'T reset isRoomCreator here - it should already be set by createRoom
      // isRoomCreator: false, // REMOVE this line
    });

    try {
      const ydoc = new Y.Doc();

      const provider = new TrysteroProvider(roomId, ydoc, {
        appId: APP_ID,
        maxConns: 5,
      });

      // Initialize with content if provided and we're the room creator
      const currentState = get(); // Get the current state to check isRoomCreator
      if (initialContent && currentState.isRoomCreator) {
        console.log("Initializing Y.Doc with content:", initialContent);
        const contentMap = ydoc.getMap("content");
        ydoc.transact(() => {
          contentMap.set("text", initialContent.text);
          contentMap.set("position", initialContent.position);
        });
      }

      set({
        provider,
        ydoc,
        status: "connected",
      });
    } catch (error) {
      console.error("Failed to join room:", error);
      set({
        status: "error",
        currentRoom: null,
        provider: null,
        ydoc: null,
        isRoomCreator: false, // Only reset on error
      });
      throw error;
    }
  },

  leaveRoom: (): void => {
    const state = get();

    if (state.provider) {
      state.provider.destroy();
    }

    if (state.ydoc) {
      state.ydoc.destroy();
    }

    set({
      currentRoom: null,
      status: "disconnected",
      provider: null,
      ydoc: null,
      isRoomCreator: false,
    });
  },

  getYDoc: (): Y.Doc | null => {
    return get().ydoc;
  },
}));

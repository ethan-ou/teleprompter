import { create } from "zustand";
import * as Y from "yjs";
import { TrysteroProvider } from "@/lib/y-webrtc-trystero";

export interface RoomState {
  currentRoom: string | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  provider: TrysteroProvider | null;
  ydoc: Y.Doc | null;
}

export interface RoomActions {
  createRoom: () => Promise<string>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
  getYDoc: () => Y.Doc | null;
}

const APP_ID = "voice-teleprompter-2193021";

export const useCollaborateStore = create<RoomState & RoomActions>()((set, get) => ({
  currentRoom: null,
  status: "disconnected",
  provider: null,
  ydoc: null,

  createRoom: async (): Promise<string> => {
    const roomId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await get().joinRoom(roomId);
    return roomId;
  },

  joinRoom: async (roomId: string): Promise<void> => {
    const state = get();

    // Leave current room if connected
    if (state.currentRoom) {
      state.leaveRoom();
    }

    set({
      status: "connecting",
      currentRoom: roomId,
    });

    try {
      const ydoc = new Y.Doc();

      const provider = new TrysteroProvider(roomId, ydoc, {
        appId: APP_ID,
        maxConns: 5,
      });

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
    });
  },

  getYDoc: (): Y.Doc | null => {
    return get().ydoc;
  },
}));

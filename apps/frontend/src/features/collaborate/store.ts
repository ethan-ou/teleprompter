import { create } from "zustand";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { Position } from "../content/store";
import { generatePassphrase } from "@/lib/generate-passphrase";

export interface RoomState {
  roomId: string | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  provider: HocuspocusProvider | null;
  ydoc: Y.Doc | null;
  creatorId: string | null;
}

export interface RoomActions {
  isCreator: () => boolean;
  isConnected: () => boolean;
  createRoom: (content: { text: string; position: Position }) => Promise<string>;
  joinRoom: (roomId: string, content?: { text: string; position: Position }) => Promise<void>;
  leaveRoom: () => void;
}

// Generate a unique client ID for this session
const clientId = crypto.randomUUID();

export const useCollaborateStore = create<RoomState & RoomActions>()((set, get) => ({
  roomId: null,
  status: "disconnected",
  provider: null,
  ydoc: null,
  creatorId: null,
  isCreator: () => get().creatorId === clientId,
  isConnected: () => get().status === "connected",

  createRoom: async (content: { text: string; position: Position }): Promise<string> => {
    const roomId = generatePassphrase({
      capitalize: true,
      numWords: 3,
      wordSeparator: "",
    });

    set({ creatorId: clientId });
    await get().joinRoom(roomId, content);
    return roomId;
  },

  joinRoom: async (
    roomId: string,
    content?: { text: string; position: Position },
  ): Promise<void> => {
    const state = get();

    if (state.roomId) {
      state.leaveRoom();
    }

    set({ status: "connecting" });

    try {
      const ydoc = new Y.Doc();
      const provider = new HocuspocusProvider({
        url: "ws://localhost:8080",
        name: roomId,
        document: ydoc,
      });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 10000);

        provider.on("status", (event: { status: string }) => {
          if (event.status === "connected") {
            clearTimeout(timeout);
            resolve();
          }
        });

        provider.on("disconnect", () => {
          clearTimeout(timeout);
          reject(new Error("Failed to connect"));
        });
      });

      // Initialize with content if provided and we're the room creator
      if (content && state.creatorId === clientId) {
        const contentMap = ydoc.getMap("content");
        ydoc.transact(() => {
          contentMap.set("text", content.text);
          contentMap.set("position", content.position);
        });
      }

      set({
        provider,
        ydoc,
        status: "connected",
        roomId,
      });
    } catch (error) {
      console.error("Failed to join room:", error);
      set({
        status: "error",
        roomId: null,
        provider: null,
        ydoc: null,
        creatorId: null,
      });
      throw error;
    }
  },

  leaveRoom: () => {
    const state = get();

    try {
      if (state.provider) {
        state.provider.destroy();
      }

      if (state.ydoc) {
        state.ydoc.destroy();
      }
    } catch (error) {
      console.error("Error while leaving room:", error);
    }

    set({
      roomId: null,
      status: "disconnected",
      provider: null,
      ydoc: null,
      creatorId: null,
    });
  },
}));

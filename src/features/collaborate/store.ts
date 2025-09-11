import { create } from "zustand";
import * as Y from "yjs";
import { TrysteroProvider } from "@/app/y-webrtc-trystero";
import { selfId } from "@/app/y-webrtc-trystero";
import { Position } from "../content/store";
import { joinRoom } from "trystero/mqtt";

const APP_ID = "voice-teleprompter-4DRPRcq3FJmdfwgHnKMOy";

export interface RoomState {
  roomId: string | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  provider: TrysteroProvider | null;
  ydoc: Y.Doc | null;
  creatorId: string | null;
  peerIds: string[];
}

export interface RoomActions {
  isCreator: () => boolean;
  createRoom: (content: { text: string; position: Position }) => Promise<string>;
  joinRoom: (roomId: string, content?: { text: string; position: Position }) => Promise<void>;
  leaveRoom: () => void;
  getYDoc: () => Y.Doc | null;
}

export const useCollaborateStore = create<RoomState & RoomActions>()((set, get) => ({
  roomId: null,
  status: "disconnected",
  provider: null,
  ydoc: null,
  creatorId: null,
  peerIds: [],
  isCreator: () => get().creatorId === selfId,
  createRoom: async (content: { text: string; position: Position }): Promise<string> => {
    const roomId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set({
      creatorId: selfId,
    });
    await get().joinRoom(roomId, content);
    return roomId;
  },

  joinRoom: async (
    roomId: string,
    content?: { text: string; position: Position },
  ): Promise<void> => {
    const state = get();

    // TODO: What happens if there's an existing room found?
    if (state.roomId) {
      state.leaveRoom();
      throw new Error("Existing room found.");
    }

    set({
      status: "connecting",
      roomId,
    });

    try {
      const ydoc = new Y.Doc();
      const provider = new TrysteroProvider(roomId, ydoc, {
        trysteroRoom: joinRoom({ appId: APP_ID }, roomId),
        maxConns: 5,
      });

      // Set up peer tracking and room creator detection
      if (state.isCreator()) {
        const roomMeta = ydoc.getMap("roomMeta");
        ydoc.transact(() => {
          roomMeta.set("creatorId", selfId);
          roomMeta.set("createdAt", Date.now());
        });
      }

      // Initialize with content if provided and we're the room creator
      if (content && state.isCreator()) {
        const contentMap = ydoc.getMap("content");
        ydoc.transact(() => {
          contentMap.set("text", content.text);
          contentMap.set("position", content.position);
        });
      }

      // Set up peer tracking via provider events
      provider.on("peers", (event) => {
        console.log(event);
        const allPeers = [...event.trysteroPeers, ...event.bcPeers];
        set({ peerIds: allPeers });

        // Check if room creator left
        const state = get();
        if (state.creatorId && !allPeers.includes(state.creatorId) && state.creatorId !== selfId) {
          console.log("Room creator left, leaving room");
          // Room creator left and we're not the creator - leave the room
          state.leaveRoom();
        }
      });

      // Monitor room metadata changes to detect the creator
      const roomMeta = ydoc.getMap("roomMeta");
      const updateCreatorInfo = () => {
        const creatorId = roomMeta.get("creatorId") as string | undefined;
        if (creatorId) {
          set({ creatorId });
        }
      };

      roomMeta.observe(updateCreatorInfo);
      updateCreatorInfo();

      set({
        provider,
        ydoc,
        status: "connected",
      });
    } catch (error) {
      console.error("Failed to join room:", error);
      set({
        status: "error",
        roomId: null,
        provider: null,
        ydoc: null,
        creatorId: null,
        peerIds: [],
      });
      throw error;
    }
  },

  leaveRoom: (): void => {
    const state = get();

    try {
      if (state.provider) {
        // Remove any event listeners before destroying
        state.provider.off("peers", () => {});
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
      peerIds: [],
    });
  },

  getYDoc: (): Y.Doc | null => {
    return get().ydoc;
  },
}));

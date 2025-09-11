import { create } from "zustand";
import * as Y from "yjs";
import { TrysteroProvider } from "@/app/y-webrtc-trystero";
import { selfId } from "@/app/y-webrtc-trystero";
import { Position } from "../content/store";

const APP_ID = "voice-teleprompter-4DRPRcq3FJmdfwgHnKMOy";

export interface RoomState {
  roomId: string | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  provider: TrysteroProvider | null;
  ydoc: Y.Doc | null;
  isCreator: boolean;
  creatorId: string | null;
  peerIds: string[];
}

export interface RoomActions {
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
  isCreator: false,
  creatorId: null,
  peerIds: [],

  createRoom: async (content: { text: string; position: Position }): Promise<string> => {
    const roomId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set({
      isCreator: true,
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

    // Leave current room if connected
    if (state.roomId) {
      state.leaveRoom();
    }

    set({
      status: "connecting",
      roomId: roomId,
      // DON'T reset isRoomCreator here - it should already be set by createRoom
      // isRoomCreator: false, // REMOVE this line
    });

    try {
      const ydoc = new Y.Doc();

      const provider = new TrysteroProvider(roomId, ydoc, {
        appId: APP_ID,
        maxConns: 5,
        // Enable filtering of broadcast channel connections within same browser
        // as recommended in the docs for better performance
        filterBcConns: true,
      });

      // Set up peer tracking and room creator detection
      const currentState = get();

      // If we're creating the room, store creator info in the Y.Doc
      if (currentState.isCreator) {
        const roomMeta = ydoc.getMap("roomMeta");
        ydoc.transact(() => {
          roomMeta.set("creatorId", selfId);
          roomMeta.set("createdAt", Date.now());
        });
      }

      // Initialize with content if provided and we're the room creator
      if (content && currentState.isCreator) {
        console.log("Initializing Y.Doc with content:", content);
        const contentMap = ydoc.getMap("content");
        ydoc.transact(() => {
          contentMap.set("text", content.text);
          contentMap.set("position", content.position);
        });
      }

      // Set up peer tracking via provider events
      provider.on("peers", (event) => {
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
          set({ creatorId: creatorId });
        }
      };

      roomMeta.observe(updateCreatorInfo);
      updateCreatorInfo(); // Initial check

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
        isCreator: false,
        creatorId: null, // Only reset on error
        peerIds: [], // Only reset on error
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
        // Clean up any observers before destroying
        const roomMeta = state.ydoc.getMap("roomMeta");
        roomMeta.unobserve(() => {});
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
      isCreator: false,
      creatorId: null,
      peerIds: [],
    });
  },

  getYDoc: (): Y.Doc | null => {
    return get().ydoc;
  },
}));

import { create } from "zustand";
import * as Y from "yjs";
import { TrysteroProvider } from "@/lib/y-webrtc-trystero";
import { selfId } from "@/lib/y-webrtc-trystero";
import { Position } from "../content/store";

export interface RoomState {
  currentRoom: string | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  provider: TrysteroProvider | null;
  ydoc: Y.Doc | null;
  isRoomCreator: boolean;
  roomCreatorId: string | null;
  connectedPeers: string[];
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
  roomCreatorId: null,
  connectedPeers: [],

  createRoom: async (initialContent?: { text: string; position: Position }): Promise<string> => {
    const roomId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set({
      isRoomCreator: true,
      roomCreatorId: selfId, // Set ourselves as the room creator
    });
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
        // Enable filtering of broadcast channel connections within same browser
        // as recommended in the docs for better performance
        filterBcConns: true,
      });

      // Set up peer tracking and room creator detection
      const currentState = get();

      // If we're creating the room, store creator info in the Y.Doc
      if (currentState.isRoomCreator) {
        const roomMeta = ydoc.getMap("roomMeta");
        ydoc.transact(() => {
          roomMeta.set("creatorId", selfId);
          roomMeta.set("createdAt", Date.now());
        });
      }

      // Initialize with content if provided and we're the room creator
      if (initialContent && currentState.isRoomCreator) {
        console.log("Initializing Y.Doc with content:", initialContent);
        const contentMap = ydoc.getMap("content");
        ydoc.transact(() => {
          contentMap.set("text", initialContent.text);
          contentMap.set("position", initialContent.position);
        });
      }

      // Set up peer tracking via provider events
      provider.on("peers", (event: any) => {
        const allPeers = [...event.trysteroPeers, ...event.bcPeers];
        set({ connectedPeers: allPeers });

        // Check if room creator left
        const state = get();
        if (
          state.roomCreatorId &&
          !allPeers.includes(state.roomCreatorId) &&
          state.roomCreatorId !== selfId
        ) {
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
          set({ roomCreatorId: creatorId });
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
        currentRoom: null,
        provider: null,
        ydoc: null,
        isRoomCreator: false,
        roomCreatorId: null, // Only reset on error
        connectedPeers: [], // Only reset on error
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
      currentRoom: null,
      status: "disconnected",
      provider: null,
      ydoc: null,
      isRoomCreator: false,
      roomCreatorId: null,
      connectedPeers: [],
    });
  },

  getYDoc: (): Y.Doc | null => {
    return get().ydoc;
  },
}));

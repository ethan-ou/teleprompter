import { create } from "zustand";
import * as Y from "yjs";
import { TrysteroProvider } from "@/app/y-webrtc-trystero";
import { selfId } from "@/app/y-webrtc-trystero";
import { Position } from "../content/store";
import { joinRoom } from "trystero/mqtt";
import { generatePassphrase } from "@/lib/generate-passphrase";

const APP_ID = "voice-teleprompter-4DRPRcq3FJmdfwgHnKMOy";

export interface RoomState {
  roomId: string | null;
  status: "disconnected" | "connected" | "error";
  provider: TrysteroProvider | null;
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

export const useCollaborateStore = create<RoomState & RoomActions>()((set, get) => ({
  roomId: null,
  status: "disconnected",
  provider: null,
  ydoc: null,
  creatorId: null,
  isCreator: () => get().creatorId === selfId,
  isConnected: () => get().status === "connected",
  createRoom: async (content: { text: string; position: Position }): Promise<string> => {
    const roomId = generatePassphrase({
      capitalize: true,
      numWords: 3,
      wordSeparator: "",
    });
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

    try {
      const ydoc = new Y.Doc();
      const provider = new TrysteroProvider(roomId, ydoc, {
        trysteroRoom: joinRoom(
          {
            appId: APP_ID,
            rtcConfig: {
              iceServers: [
                {
                  urls: "stun:stun.relay.metered.ca:80",
                },
                {
                  urls: "turn:standard.relay.metered.ca:80",
                  username: "2067430dcd7003f6f22de535",
                  credential: "NOp0t02fAg2VlzyY",
                },
                {
                  urls: "turn:standard.relay.metered.ca:80?transport=tcp",
                  username: "2067430dcd7003f6f22de535",
                  credential: "NOp0t02fAg2VlzyY",
                },
                {
                  urls: "turn:standard.relay.metered.ca:443",
                  username: "2067430dcd7003f6f22de535",
                  credential: "NOp0t02fAg2VlzyY",
                },
                {
                  urls: "turns:standard.relay.metered.ca:443?transport=tcp",
                  username: "2067430dcd7003f6f22de535",
                  credential: "NOp0t02fAg2VlzyY",
                },
              ],
            },
          },
          roomId,
        ),
        maxConns: 5,
        filterBcConns: false,
      });

      // Initialize with content if provided and we're the room creator
      if (content && state.isCreator()) {
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

  leaveRoom: async () => {
    const state = get();

    try {
      if (state.provider) {
        await state.provider.trystero.leave();
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

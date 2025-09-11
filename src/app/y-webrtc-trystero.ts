import * as bc from "lib0/broadcastchannel";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as error from "lib0/error";
import * as logging from "lib0/logging";
import * as map from "lib0/map";
import * as math from "lib0/math";
import { createMutex } from "lib0/mutex";
import { ObservableV2 as ObservableV2Base } from "lib0/observable";
import * as random from "lib0/random";

import { selfId, joinRoom as defaultJoinRoom, Room as TrysteroRoom } from "trystero";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import { Doc as YDoc } from "yjs";

// Type definitions
type Awareness = awarenessProtocol.Awareness;
type AccessLevel = "view" | "edit";

interface ProviderOptions {
  appId?: string;
  trysteroRoom?: TrysteroRoom;
  joinRoom?: (opts: any, roomId: string) => TrysteroRoom;
  password?: string;
  awareness?: Awareness;
  maxConns?: number;
  filterBcConns?: boolean;
  accessLevel?: AccessLevel;
  peerOpts?: any;
}

interface TrysteroProviderEvents {
  status: (event: { connected: boolean }) => void;
  synced: (event: { synced: boolean }) => void;
  destroy: () => void;
  peers: (event: {
    added: string[];
    removed: string[];
    trysteroPeers: string[];
    bcPeers: string[];
  }) => void;
}

// Message types - these match y-protocols/constants
const messageSync = 0;
const messageAwareness = 1;
const messageQueryAwareness = 3;
const messageBcPeerId = 4;

const log = logging.createModuleLogger("y-webrtc-trystero");

// Re-export for convenience
export { selfId };

export const rooms = new Map<string, TrysteroDocRoom>();

export const getRoom = (roomId: string): TrysteroDocRoom | undefined => rooms.get(roomId);

const checkIsSynced = (room: TrysteroDocRoom): void => {
  let synced = true;
  room.trysteroConns.forEach((peer) => {
    if (!peer.synced) {
      synced = false;
    }
  });
  if ((!synced && room.synced) || (synced && !room.synced)) {
    room.synced = synced;
    room.provider.emit("synced", [{ synced }]);
    log("synced ", logging.BOLD, room.name, logging.UNBOLD, " with all peers");
  }
};

const readSyncMessage = (
  decoder: decoding.Decoder,
  encoder: encoding.Encoder,
  doc: YDoc,
  transactionOrigin: any,
  accessLevel: AccessLevel,
): number => {
  const messageType = decoding.readVarUint(decoder);
  switch (messageType) {
    case syncProtocol.messageYjsSyncStep1:
      syncProtocol.readSyncStep1(decoder, encoder, doc);
      break;
    case syncProtocol.messageYjsSyncStep2:
      if (accessLevel !== "edit") {
        console.warn("edit disabled", doc.guid);
        return messageType;
      }
      syncProtocol.readSyncStep2(decoder, doc, transactionOrigin);
      break;
    case syncProtocol.messageYjsUpdate:
      if (accessLevel !== "edit") {
        console.warn("edit disabled", doc.guid, accessLevel);
        return messageType;
      }
      syncProtocol.readUpdate(decoder, doc, transactionOrigin);
      break;
    default:
      throw new Error("Unknown message type");
  }
  return messageType;
};

const readMessage = (
  room: TrysteroDocRoom,
  buf: Uint8Array,
  syncedCallback: () => void,
): encoding.Encoder | null => {
  const decoder = decoding.createDecoder(buf);
  const encoder = encoding.createEncoder();
  const messageType = decoding.readVarUint(decoder);
  if (room === undefined) {
    return null;
  }
  const awareness = room.awareness;
  const doc = room.doc;
  let sendReply = false;
  switch (messageType) {
    case messageSync: {
      encoding.writeVarUint(encoder, messageSync);
      const syncMessageType = readSyncMessage(
        decoder,
        encoder,
        doc,
        room,
        room.provider.accessLevel || "edit", // Default to 'edit' for backward compatibility
      );
      if (syncMessageType === syncProtocol.messageYjsSyncStep2 && !room.synced) {
        syncedCallback();
      }
      if (syncMessageType === syncProtocol.messageYjsSyncStep1) {
        sendReply = true;
      }
      break;
    }
    case messageQueryAwareness:
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(
          awareness,
          Array.from(awareness.getStates().keys()),
        ),
      );
      sendReply = true;
      break;
    case messageAwareness:
      awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), room);
      break;
    case messageBcPeerId: {
      const add = decoding.readUint8(decoder) === 1;
      const peerName = decoding.readVarString(decoder);
      if (
        peerName !== room.peerId &&
        ((room.bcConns.has(peerName) && !add) || (!room.bcConns.has(peerName) && add))
      ) {
        const removed = [];
        const added = [];
        if (add) {
          room.bcConns.add(peerName);
          added.push(peerName);
        } else {
          room.bcConns.delete(peerName);
          removed.push(peerName);
        }
        room.provider.emit("peers", [
          {
            added,
            removed,
            trysteroPeers: Array.from(room.trysteroConns.keys()),
            bcPeers: Array.from(room.bcConns),
          },
        ]);
        broadcastBcPeerId(room);
      }
      break;
    }
    default:
      console.error("Unable to compute message");
      return encoder;
  }
  if (!sendReply) {
    // nothing has been written, no answer created
    return null;
  }
  return encoder;
};

const readPeerMessage = (peerConn: TrysteroConn, buf: Uint8Array): encoding.Encoder | null => {
  const room = peerConn.room;
  log(
    "received message from ",
    logging.BOLD,
    peerConn.remotePeerId,
    logging.GREY,
    " (",
    room.name,
    ")",
    logging.UNBOLD,
    logging.UNCOLOR,
  );
  return readMessage(room, buf, () => {
    peerConn.synced = true;
    log(
      "synced ",
      logging.BOLD,
      room.name,
      logging.UNBOLD,
      " with ",
      logging.BOLD,
      peerConn.remotePeerId,
    );
    checkIsSynced(room);
  });
};

const sendTrysteroConn = (trysteroConn: TrysteroConn, encoder: encoding.Encoder): void => {
  log(
    "send message to ",
    logging.BOLD,
    trysteroConn.remotePeerId,
    logging.UNBOLD,
    logging.GREY,
    " (",
    trysteroConn.room.name,
    ")",
    logging.UNCOLOR,
  );
  try {
    trysteroConn.room.provider.sendDocData(
      encoding.toUint8Array(encoder),
      trysteroConn.remotePeerId,
    );
  } catch (e) {
    console.log("error sending", e);
  }
};

const broadcastTrysteroConn = (room: TrysteroDocRoom, m: Uint8Array): void => {
  log("broadcast message in ", logging.BOLD, room.name, logging.UNBOLD);
  room.trysteroConns.forEach((conn) => {
    try {
      conn.room.provider.sendDocData(m);
    } catch (e) {
      console.log("error broadcasting", e);
    }
  });
};

export class TrysteroConn {
  room: TrysteroDocRoom;
  remotePeerId: string;
  closed: boolean;
  connected: boolean;
  synced: boolean;

  constructor(remotePeerId: string, room: TrysteroDocRoom) {
    log("connected to ", logging.BOLD, remotePeerId);
    this.room = room;
    this.remotePeerId = remotePeerId;
    this.closed = false;
    this.connected = false;
    this.synced = false;

    // already connected
    this.connected = true;
    // send sync step 1
    const provider = room.provider;
    const doc = provider.doc;
    const awareness = room.awareness;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    sendTrysteroConn(this, encoder);
    const awarenessStates = awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys())),
      );
      sendTrysteroConn(this, encoder);
    }
    provider.listenDocData((data: unknown, peerId?: string) => {
      const arr = data as Uint8Array;
      try {
        const answer = readPeerMessage(this, arr);
        if (answer !== null) {
          sendTrysteroConn(this, answer);
        }
      } catch (err) {
        console.log(err);
      }
    });
  }

  onClose(): void {
    this.connected = false;
    this.closed = true;
    const { room, remotePeerId } = this;
    if (room.trysteroConns.has(remotePeerId)) {
      room.trysteroConns.delete(remotePeerId);
      room.provider.emit("peers", [
        {
          removed: [remotePeerId],
          added: [],
          trysteroPeers: Array.from(room.trysteroConns.keys()),
          bcPeers: Array.from(room.bcConns),
        },
      ]);
    }
    checkIsSynced(room);
    log("closed connection to ", logging.BOLD, remotePeerId);
  }

  destroy(): void {
    // console.log("todo: destroy conn(?)");
  }
}

const broadcastBcMessage = (room: TrysteroDocRoom, m: Uint8Array): void => {
  room.mux(() => {
    bc.publish(room.name, m);
  });
};

const broadcastRoomMessage = (room: TrysteroDocRoom, m: Uint8Array): void => {
  if (room.bcconnected) {
    broadcastBcMessage(room, m);
  }
  broadcastTrysteroConn(room, m);
};

const broadcastBcPeerId = (room: TrysteroDocRoom): void => {
  if (room.provider.filterBcConns) {
    // broadcast peerId via broadcastchannel
    const encoderPeerIdBc = encoding.createEncoder();
    encoding.writeVarUint(encoderPeerIdBc, messageBcPeerId);
    encoding.writeUint8(encoderPeerIdBc, 1);
    encoding.writeVarString(encoderPeerIdBc, room.peerId);
    broadcastBcMessage(room, encoding.toUint8Array(encoderPeerIdBc));
  }
};

export class TrysteroDocRoom {
  peerId: string;
  doc: YDoc;
  awareness: Awareness;
  provider: TrysteroProvider;
  synced: boolean;
  name: string;
  password: string | undefined;
  trysteroConns: Map<string, TrysteroConn>;
  bcConns: Set<string>;
  mux: (fn: () => void) => void;
  bcconnected: boolean;
  _bcSubscriber: (data: ArrayBuffer) => void;
  _docUpdateHandler: (update: Uint8Array, origin: any) => void;
  _awarenessUpdateHandler: (
    changed: { added: number[]; updated: number[]; removed: number[] },
    origin: any,
  ) => void;
  _beforeUnloadHandler: () => void;

  constructor(doc: YDoc, provider: TrysteroProvider, name: string, password?: string) {
    this.peerId = selfId;
    this.doc = doc;
    /**
     * @type {awarenessProtocol.Awareness}
     */
    this.awareness = provider.awareness;
    this.provider = provider;
    this.synced = false;
    this.name = name;
    this.password = password;
    /**
     * @type {Map<string, TrysteroConn>}
     */
    this.trysteroConns = new Map();
    /**
     * @type {Set<string>}
     */
    this.bcConns = new Set();
    this.mux = createMutex();
    this.bcconnected = false;
    /**
     * @param {ArrayBuffer} data
     */
    this._bcSubscriber = (data: ArrayBuffer): void => {
      this.mux(() => {
        const reply = readMessage(this, new Uint8Array(data), () => {});
        if (reply) {
          broadcastBcMessage(this, encoding.toUint8Array(reply));
        }
      });
    };
    this._docUpdateHandler = (update: Uint8Array, _origin: any): void => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      broadcastRoomMessage(this, encoding.toUint8Array(encoder));
    };
    this._awarenessUpdateHandler = (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      _origin: any,
    ): void => {
      const changedClients = added.concat(updated).concat(removed);
      const encoderAwareness = encoding.createEncoder();
      encoding.writeVarUint(encoderAwareness, messageAwareness);
      encoding.writeVarUint8Array(
        encoderAwareness,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
      );
      broadcastRoomMessage(this, encoding.toUint8Array(encoderAwareness));
    };

    this._beforeUnloadHandler = () => {
      awarenessProtocol.removeAwarenessStates(this.awareness, [doc.clientID], "window unload");
      rooms.forEach((room) => {
        room.disconnect();
      });
    };

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this._beforeUnloadHandler);
    } else if (typeof process !== "undefined") {
      process.on("exit", this._beforeUnloadHandler);
    }

    provider.trystero.onPeerJoin((peerId: string) => {
      log(`${peerId} joined`);
      if (this.trysteroConns.size < provider.maxConns) {
        map.setIfUndefined(this.trysteroConns, peerId, () => {
          if (!provider.room) throw new Error("Room not initialized");
          return new TrysteroConn(peerId, provider.room);
        });
      }
    });
    provider.trystero.onPeerLeave((peerId: string) => {
      const conn = this.trysteroConns.get(peerId);
      if (conn) conn.onClose();
      if (this.trysteroConns.has(peerId)) {
        this.trysteroConns.delete(peerId);
        this.provider.emit("peers", [
          {
            removed: [peerId],
            added: [],
            trysteroPeers: provider.room ? Array.from(provider.room.trysteroConns.keys()) : [],
            bcPeers: Array.from(this.bcConns),
          },
        ]);
      }
      checkIsSynced(this);
      log("closed connection to ", logging.BOLD, peerId);
    });
  }

  connectToDoc(): void {
    this.doc.on("update", this._docUpdateHandler);
    this.awareness.on("update", this._awarenessUpdateHandler);
    const roomName = this.name;
    bc.subscribe(roomName, this._bcSubscriber);
    this.bcconnected = true;
    // broadcast peerId via broadcastchannel
    broadcastBcPeerId(this);
    // write sync step 1
    const encoderSync = encoding.createEncoder();
    encoding.writeVarUint(encoderSync, messageSync);
    syncProtocol.writeSyncStep1(encoderSync, this.doc);
    broadcastBcMessage(this, encoding.toUint8Array(encoderSync));
    // broadcast local state
    const encoderState = encoding.createEncoder();
    encoding.writeVarUint(encoderState, messageSync);
    syncProtocol.writeSyncStep2(encoderState, this.doc);
    broadcastBcMessage(this, encoding.toUint8Array(encoderState));
    // write queryAwareness
    const encoderAwarenessQuery = encoding.createEncoder();
    encoding.writeVarUint(encoderAwarenessQuery, messageQueryAwareness);
    broadcastBcMessage(this, encoding.toUint8Array(encoderAwarenessQuery));
    // broadcast local awareness state
    const encoderAwarenessState = encoding.createEncoder();
    encoding.writeVarUint(encoderAwarenessState, messageAwareness);
    encoding.writeVarUint8Array(
      encoderAwarenessState,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID]),
    );
    broadcastBcMessage(this, encoding.toUint8Array(encoderAwarenessState));
  }

  disconnect(): void {
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], "disconnect");
    // broadcast peerId removal via broadcastchannel
    const encoderPeerIdBc = encoding.createEncoder();
    encoding.writeVarUint(encoderPeerIdBc, messageBcPeerId);
    encoding.writeUint8(encoderPeerIdBc, 0); // remove peerId from other bc peers
    encoding.writeVarString(encoderPeerIdBc, this.peerId);
    broadcastBcMessage(this, encoding.toUint8Array(encoderPeerIdBc));

    bc.unsubscribe(this.name, this._bcSubscriber);
    this.bcconnected = false;
    this.doc.off("update", this._docUpdateHandler);
    this.awareness.off("update", this._awarenessUpdateHandler);
    this.trysteroConns.forEach((conn) => conn.destroy());
  }

  destroy(): void {
    this.disconnect();
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this._beforeUnloadHandler);
    } else if (typeof process !== "undefined") {
      process.off("exit", this._beforeUnloadHandler);
    }
  }
}

const openRoom = (
  doc: YDoc,
  provider: TrysteroProvider,
  name: string,
  password?: string,
): TrysteroDocRoom => {
  // there must only be one room
  if (rooms.has(name)) {
    throw error.create(`A Yjs Doc connected to room "${name}" already exists!`);
  }
  const room = new TrysteroDocRoom(doc, provider, name, password);
  room.connectToDoc();
  rooms.set(name, /** @type {TrysteroDocRoom} */ room);
  return room;
};

/**
 * @typedef {Object} ProviderOptions
 * @property {string} [appId] - The Trystero app ID. Defaults to 'y-webrtc-trystero-app'.
 * @property {TrysteroRoom} [trysteroRoom] - The TrysteroRoom instance. If not provided, one will be created.
 * @property {(opts: any, roomId: string) => TrysteroRoom} [joinRoom] - Function to join a Trystero room.
 * @property {string} [password] - Optional password for encryption.
 * @property {Awareness} [awareness] - Awareness instance. If not provided, a new one will be created.
 * @property {number} [maxConns] - Maximum number of connections. Defaults to a random number between 20-34.
 * @property {boolean} [filterBcConns=true] - Whether to filter broadcast connections.
 * @property {'view' | 'edit'} [accessLevel='edit'] - Access level for the document ('view' or 'edit').
 * @property {any} [peerOpts] - Additional peer options.
 */

// Export types for TypeScript consumers
export {};

/**
 * @typedef {Object} TrysteroProviderEvents
 * @property {(event: { connected: boolean }) => void} status - Emitted when connection status changes.
 * @property {(event: { synced: boolean }) => void} synced - Emitted when sync status changes.
 * @property {() => void} destroy - Emitted when the provider is destroyed.
 * @property {(event: {
 *   added: string[],
 *   removed: string[],
 *   trysteroPeers: string[],
 *   bcPeers: string[]
 * }) => void} peers - Emitted when peer list changes.
 */

/** @typedef {import('lib0/observable').ObservableV2<TrysteroProviderEvents>} ObservableV2 */

/** @extends {ObservableV2Base<TrysteroProviderEvents>} */
export class TrysteroProvider extends ObservableV2Base<TrysteroProviderEvents> {
  doc: YDoc;
  maxConns: number;
  filterBcConns: boolean;
  accessLevel: AccessLevel;
  password?: string;
  trystero: TrysteroRoom;
  room: TrysteroDocRoom | null;
  roomName: string;
  awareness: Awareness;
  sendDocData: (data: Uint8Array, peerId?: string) => void;
  listenDocData: (callback: (data: unknown, peerId?: string) => void) => void;

  constructor(
    roomName: string,
    doc: YDoc,
    {
      appId,
      password,
      joinRoom,
      trysteroRoom = (joinRoom || defaultJoinRoom)(
        { appId: appId || "y-webrtc-trystero-app", password },
        roomName,
      ),
      awareness = new awarenessProtocol.Awareness(doc),
      maxConns = 20 + math.floor(random.rand() * 15), // the random factor reduces the chance that n clients form a cluster
      filterBcConns = true,
      accessLevel = "edit" as AccessLevel, // Default to 'edit' for backward compatibility
    }: ProviderOptions = {} as ProviderOptions,
  ) {
    super();
    this.doc = doc;
    this.maxConns = maxConns;
    this.filterBcConns = filterBcConns;
    this.accessLevel = accessLevel;
    this.password = password;
    this.trystero = trysteroRoom;
    /**
     * @type {TrysteroDocRoom|null}
     */
    this.room = null;
    this.roomName = roomName;
    /**
     * @type {awarenessProtocol.Awareness}
     */
    this.awareness = awareness;

    // Create the room with the password
    this.room = openRoom(doc, this, roomName, password);
    doc.on("destroy", () => this.destroy());

    // Set up Trystero actions
    const [sendDocData, listenDocData] = trysteroRoom.makeAction("docdata");
    this.sendDocData = sendDocData;
    this.listenDocData = listenDocData;
  }

  destroy(): void {
    this.doc.off("destroy", this.destroy);
    // Clean up the room immediately
    if (this.room) {
      this.room.destroy();
      rooms.delete(this.roomName);
    }
    this.emit("destroy", []);
    super.destroy();
  }
}

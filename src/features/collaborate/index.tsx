import { useState } from "react";
import { Dialog, Input } from "@base-ui-components/react";
import { X, Copy, Check } from "lucide-react";
import { useCollaborateStore } from "./store";
import { useContent } from "../content/store";
import { useNavbarStore } from "../navbar/store";

export function Collaborate() {
  const [joinRoomId, setJoinRoomId] = useState("");
  const [copied, setCopied] = useState(false);
  const content = useContent();
  const collaborate = useNavbarStore((state) => state.collaborate);
  const setCollaborate = useNavbarStore((state) => state.setCollaborate);

  const {
    roomId: currentRoom,
    status,
    createRoom,
    joinRoom,
    leaveRoom,
    isCreator,
    isConnected,
  } = useCollaborateStore();

  const handleCreateRoom = async () => {
    try {
      await createRoom({
        text: content.text,
        position: content.position,
      });
    } catch (error) {
      console.error("Failed to create room:", error);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinRoomId.trim()) return;

    try {
      await joinRoom(joinRoomId.trim());
      setJoinRoomId("");
    } catch (error) {
      console.error("Failed to join room:", error);
    }
  };

  const handleLeaveRoom = () => {
    leaveRoom();
  };

  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(currentRoom || "");
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 3000);
    } catch (error) {
      console.error("Failed to copy room ID:", error);
    }
  };

  return (
    <Dialog.Root
      open={collaborate}
      modal="trap-focus"
      onOpenChange={(open) => {
        setCollaborate(open);
        setCopied(false);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black opacity-20 transition-all duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 dark:opacity-70" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-96 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 rounded-lg bg-neutral-900 p-6 text-neutral-100 outline outline-neutral-700 transition-all duration-150 data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
          <Dialog.Close className="button absolute top-2 right-2">
            <X />
          </Dialog.Close>
          {isConnected() ? (
            <>
              <div className="flex flex-col items-center gap-2">
                <Dialog.Title className="text-lg font-semibold">
                  Connected to Room {isCreator() ? "(Host)" : "(Guest)"}
                </Dialog.Title>
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <code className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 font-mono select-all">
                      {currentRoom}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyRoomId}
                      className="button rounded border border-neutral-700"
                      title={copied ? "Copied!" : "Copy Room ID"}
                    >
                      {copied ? (
                        <Check className="p-0.5 text-green-400" />
                      ) : (
                        <Copy className="p-0.5" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-center text-sm text-neutral-400">
                  Collaborators can edit text and sync to voice.
                </p>
              </div>

              <button
                type="button"
                onClick={handleLeaveRoom}
                className="cursor-pointer rounded-md bg-red-700 px-4 py-2 text-white hover:bg-red-600"
              >
                Leave Room
              </button>
            </>
          ) : (
            <>
              <Dialog.Title className="text-lg font-semibold">Collaborate Mode</Dialog.Title>
              <button
                type="button"
                onClick={handleCreateRoom}
                className="cursor-pointer rounded-md bg-blue-700 px-4 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create a Room
              </button>

              <div className="flex w-full items-center">
                <div className="h-px flex-1 bg-neutral-800"></div>
                <span className="px-4 text-sm text-neutral-500">OR</span>
                <div className="h-px flex-1 bg-neutral-800"></div>
              </div>

              <div className="flex w-full gap-1">
                <Input
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="Enter Room Name"
                  className="h-10 w-full rounded-md border border-neutral-700 pl-3.5 text-base text-neutral-100 focus:outline-2 focus:-outline-offset-1 focus:outline-blue-800"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleJoinRoom();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleJoinRoom}
                  disabled={!joinRoomId.trim()}
                  className="h-10 cursor-pointer rounded-md px-4 py-2 text-white outline outline-blue-700 hover:bg-blue-900/20 hover:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Join
                </button>
              </div>

              <p className="text-center text-sm text-neutral-400">
                Devices require a shared network connection
              </p>
              {status === "error" && (
                <p className="text-sm text-red-400">Failed to connect to room. Please try again.</p>
              )}
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

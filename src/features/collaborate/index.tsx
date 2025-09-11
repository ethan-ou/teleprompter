import { useState } from "react";
import { Tooltip, TooltipContext } from "@/components/Tooltip";
import { Dialog, Input } from "@base-ui-components/react";
import { UsersRound, X } from "lucide-react";
import { useCollaborateStore } from "./store";
import { useContent } from "../content/store";

export function Collaborate() {
  const [joinRoomId, setJoinRoomId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const content = useContent();

  const {
    roomId: currentRoom,
    status,
    createRoom,
    joinRoom,
    leaveRoom,
    provider,
  } = useCollaborateStore();

  const isConnected = status === "connected";

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
  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <TooltipContext>
        <Dialog.Trigger type="button" className="button">
          <UsersRound className={`icon ${isConnected ? "yellow" : ""}`} />
        </Dialog.Trigger>
        <Tooltip>{isConnected ? `Connected to ${currentRoom}` : "Collaborate"}</Tooltip>
      </TooltipContext>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black opacity-20 transition-all duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 dark:opacity-70" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 -mt-8 flex w-96 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 rounded-lg bg-neutral-900 p-6 text-neutral-100 outline outline-neutral-700 transition-all duration-150 data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
          <Dialog.Close className="button absolute top-2 right-2">
            <X />
          </Dialog.Close>
          {isConnected ? (
            <>
              <div className="text-center">
                <h3 className="text-lg font-semibold">Connected to Room</h3>
                <p className="text-sm text-neutral-500">Room ID: {currentRoom}</p>
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
              <h3 className="text-lg font-semibold">Join Collaboration</h3>

              <button
                type="button"
                onClick={handleCreateRoom}
                className="cursor-pointer rounded-md bg-blue-700 px-4 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create a Room
              </button>

              <p className="text-neutral-400">OR</p>

              <div className="flex w-full gap-1">
                <Input
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="Enter Room ID"
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

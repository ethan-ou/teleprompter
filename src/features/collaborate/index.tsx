import { Tooltip, TooltipContext } from "@/components/Tooltip";
import { Dialog, Input } from "@base-ui-components/react";
import { UsersRound } from "lucide-react";

export function Collaborate() {
  const collaborate = false;
  return (
    <Dialog.Root>
      <TooltipContext>
        <Dialog.Trigger type="button" className="button">
          <UsersRound className={`icon ${collaborate ? "yellow" : ""}`} />
        </Dialog.Trigger>
        <Tooltip>
          Collaborate
          {/* <kbd>F</kbd> */}
        </Tooltip>
      </TooltipContext>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black opacity-20 transition-all duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 dark:opacity-70" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 -mt-8 flex w-96 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-lg bg-neutral-900 p-6 text-neutral-100 outline outline-neutral-700 transition-all duration-150 data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
          <button className="cursor-pointer rounded-md bg-blue-700 px-4 py-2 text-white hover:bg-blue-600">
            Create a Room
          </button>
          <p>OR</p>
          <div className="flex gap-1">
            <Input
              placeholder="Enter your Room Name"
              className="h-10 w-full max-w-64 rounded-md border border-neutral-700 pl-3.5 text-base text-neutral-100 focus:outline-2 focus:-outline-offset-1 focus:outline-blue-800"
            />
            <button className="h-10 cursor-pointer rounded-md px-4 py-2 text-white outline outline-blue-700 hover:bg-blue-900/20 hover:outline-blue-600">
              Join
            </button>
          </div>
          <div className="flex justify-end gap-4">
            <Dialog.Close className="flex h-10 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 px-3.5 text-base font-medium text-neutral-100 select-none hover:bg-neutral-800 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-blue-800 active:bg-gray-100">
              Close
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

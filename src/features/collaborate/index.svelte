<script lang="ts">
  import { X, Copy, Check } from "lucide-svelte";
  import { collaborateStore } from "./store.svelte";
  import { contentStore } from "../content/store.svelte";
  import { navbarStore } from "../navbar/store.svelte";

  let joinRoomId = $state("");
  let copied = $state(false);
  let dialog = $state<HTMLDialogElement>();

  // Watch for collaborate state changes to open/close dialog
  $effect(() => {
    if (navbarStore.collaborate) {
      dialog?.showModal();
    } else {
      dialog?.close();
    }
  });

  const createRoom = async () => {
    try {
      await collaborateStore.createRoom({
        text: contentStore.text(),
        position: contentStore.position(),
      });
    } catch (error) {
      console.error("Failed to create room:", error);
    }
  };

  const joinRoom = async () => {
    const roomId = joinRoomId.trim();
    if (!roomId) return;

    try {
      await collaborateStore.joinRoom(roomId);
      joinRoomId = "";
    } catch (error) {
      console.error("Failed to join room:", error);
    }
  };

  const leaveRoom = () => {
    collaborateStore.leaveRoom();
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(collaborateStore.roomId || "");
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 3000);
    } catch (error) {
      console.error("Failed to copy room ID:", error);
    }
  };

  const closeDialog = () => {
    navbarStore.setCollaborate(false);
    copied = false;
  };
</script>

<dialog
  bind:this={dialog}
  class="fixed top-1/2 left-1/2 z-50 flex w-96 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 rounded-lg bg-neutral-900 p-6 text-neutral-100 outline outline-neutral-700 backdrop:bg-black backdrop:opacity-20 dark:backdrop:opacity-70"
  onclose={closeDialog}
>
  <button
    type="button"
    onclick={closeDialog}
    class="button absolute top-2 right-2"
  >
    <X />
  </button>

  {#if collaborateStore.isConnected}
    <div class="flex flex-col items-center gap-2">
      <h2 class="text-lg font-semibold">
        Connected to Room {collaborateStore.isCreator ? "(Host)" : "(Guest)"}
      </h2>
      <div>
        <div class="flex items-center justify-center gap-1">
          <code class="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 font-mono select-all">
            {collaborateStore.roomId}
          </code>
          <button
            type="button"
            onclick={copyRoomId}
            class="button rounded border border-neutral-700"
            title={copied ? "Copied!" : "Copy Room ID"}
          >
            {#if copied}
              <Check class="p-0.5 text-green-400" />
            {:else}
              <Copy class="p-0.5" />
            {/if}
          </button>
        </div>
      </div>
      <p class="text-center text-sm text-neutral-400">
        Collaborators can edit text and sync to voice.
      </p>
    </div>

    <button
      type="button"
      onclick={leaveRoom}
      class="cursor-pointer rounded-md bg-red-700 px-4 py-2 text-white hover:bg-red-600"
    >
      Leave Room
    </button>
  {:else}
    <h2 class="text-lg font-semibold">Collaborate Mode</h2>
    <button
      type="button"
      onclick={createRoom}
      class="cursor-pointer rounded-md bg-blue-700 px-4 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Create a Room
    </button>

    <div class="flex w-full items-center">
      <div class="h-px flex-1 bg-neutral-800"></div>
      <span class="px-4 text-sm text-neutral-500">OR</span>
      <div class="h-px flex-1 bg-neutral-800"></div>
    </div>

    <div class="flex w-full gap-1">
      <input
        bind:value={joinRoomId}
        placeholder="Enter Room Name"
        class="h-10 w-full rounded-md border border-neutral-700 pl-3.5 text-base text-neutral-100 focus:outline-2 focus:-outline-offset-1 focus:outline-blue-800"
        onkeydown={(e) => e.key === "Enter" && joinRoom()}
      />
      <button
        type="button"
        onclick={joinRoom}
        disabled={!joinRoomId.trim()}
        class="h-10 cursor-pointer rounded-md px-4 py-2 text-white outline outline-blue-700 hover:bg-blue-900/20 hover:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Join
      </button>
    </div>

    <p class="text-center text-sm text-neutral-400">
      Devices require a shared network connection
    </p>
    {#if collaborateStore.status === "error"}
      <p class="text-sm text-red-400">Failed to connect to room. Please try again.</p>
    {/if}
  {/if}
</dialog>
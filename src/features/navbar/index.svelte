<script lang="ts">
  import { createFullscreen } from "@/app/fullscreen.svelte";
  import { recognizerStore } from "@/app/recognizer.svelte";
  import { navbarStore } from "./store.svelte";
  import { contentStore } from "../content/store.svelte";
  import { collaborateStore } from "../collaborate/store.svelte";
  import * as Tooltip from "@/components/tooltip/index.js";
  import {
    Pencil,
    MoveHorizontal,
    Play,
    Pause,
    Expand,
    Trash2,
    AArrowUp,
    Minimize2,
    Sun,
    TextAlignCenter,
    SunDim,
    SunMedium,
    Undo2,
    MonitorUp,
    UsersRound,
  } from "lucide-svelte";
  import DragInput from "@/components/DragInput.svelte";
  import { cn } from "@/lib/css";
  import { isMobileOrTablet } from "@/lib/device";
  import { getBoundsStart, resetTranscriptWindow } from "@/lib/speech-matcher";

  const mobileOrTablet = isMobileOrTablet();

  // Create fullscreen handler
  const fullscreen = createFullscreen((active) => navbarStore.setHide(active));

  // Focus tracking for hotkeys
  let focused = $state(false);

  // Timer effect - runs when status is "started"
  let timerInterval: number | undefined = $state();

  $effect(() => {
    if (navbarStore.status === "started") {
      timerInterval = setInterval(navbarStore.incrementTimer, 1000);
    } else {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = undefined;
      }
    }

    // Cleanup on unmount
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  });

  // Hotkey handlers
  function handleKeydown(event: KeyboardEvent) {
    if (focused || navbarStore.status === "editing") return; // Don't trigger when focused on inputs

    switch (event.code) {
      case "Space":
        if (navbarStore.status !== "editing") {
          event.preventDefault();
          navbarStore.status === "stopped" ? recognizerStore.startTeleprompter() : recognizerStore.stopTeleprompter();
        }
        break;
      case "Escape":
        if (navbarStore.status === "started") {
          recognizerStore.stopTeleprompter();
        }
        break;
      case "KeyE":
        if (navbarStore.status !== "started") {
          navbarStore.toggleEdit();
        }
        break;
      case "Delete":
        if (navbarStore.status !== "started") {
          if (confirm("Are you sure you want to clear your script?")) {
            contentStore.setText("");
          }
        }
        break;
      case "KeyM":
        if (navbarStore.status !== "editing") {
          navbarStore.toggleMirror();
        }
        break;
      case "KeyF":
        fullscreen.active ? fullscreen.exit() : fullscreen.enter();
        break;
      case "KeyH":
        navbarStore.setHide(!navbarStore.hide);
        break;
      case "KeyS":
        if (!mobileOrTablet) {
          navbarStore.setCast(!navbarStore.cast);
        }
        break;
      case "KeyR":
        if (navbarStore.status !== "editing") {
          handleRestart();
        }
        break;
      case "KeyT":
        navbarStore.setAlign("top");
        break;
      case "KeyC":
        navbarStore.setAlign("center");
        break;
      case "KeyB":
        navbarStore.setAlign("bottom");
        break;
      case "Equal":
      case "Minus":
        handleFontSizeShortcut(event);
        break;
      case "BracketLeft":
      case "BracketRight":
        handleMarginShortcut(event);
        break;
      case "Semicolon":
      case "Quote":
        handleOpacityShortcut(event);
        break;
    }
  }

  function handleFontSizeShortcut(event: KeyboardEvent) {
    const step = 5;
    const current = navbarStore.fontSize;
    if (event.code === "Equal") {
      navbarStore.setFontSize(Math.min(current + step, 150));
    } else {
      navbarStore.setFontSize(Math.max(current - step, 15));
    }
  }

  function handleMarginShortcut(event: KeyboardEvent) {
    const step = 2;
    const current = navbarStore.margin;
    if (event.code === "BracketRight") {
      navbarStore.setMargin(Math.min(current + step, 44));
    } else {
      navbarStore.setMargin(Math.max(current - step, 0));
    }
  }

  function handleOpacityShortcut(event: KeyboardEvent) {
    const step = 10;
    const current = navbarStore.opacity;
    if (event.code === "Quote") {
      navbarStore.setOpacity(Math.min(current + step, 100));
    } else {
      navbarStore.setOpacity(Math.max(current - step, 20));
    }
  }

  function handleRestart() {
    const selectedPosition = -1;
    const boundStart = getBoundsStart(contentStore.tokens(), 0);
    contentStore.setPosition({
      start: selectedPosition,
      end: selectedPosition,
      search: selectedPosition,
      ...(boundStart !== undefined && { bounds: boundStart }),
    });
    navbarStore.resetTimer();
    resetTranscriptWindow();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Format timer display
  const formattedTimer = $derived(
    `${Math.floor(navbarStore.timer / (60 * 60)).toString().padStart(2, "0")}:${Math.floor((navbarStore.timer / 60) % 60).toString().padStart(2, "0")}:${(navbarStore.timer % 60).toString().padStart(2, "0")}`
  );

  // Brightness icon based on opacity
  const BrightnessIcon = $derived(
    navbarStore.opacity > 80 ? Sun :
    navbarStore.opacity > 50 ? SunMedium :
    SunDim
  );
</script>

<svelte:window onkeydown={handleKeydown} />

<nav
  aria-label="main navigation"
  class={cn(
    "top-0 z-10 flex w-full flex-wrap items-center justify-evenly gap-x-4 gap-y-1 border-b border-neutral-800 bg-neutral-950/90 px-3 py-2 text-white backdrop-blur transition select-none hover:opacity-100 min-[925px]:justify-between",
    navbarStore.hide ? "fixed -translate-y-full" : "sticky translate-y-0",
  )}
>
  <Tooltip.Provider>
    <!-- Button Section -->
    <div
      class="flex flex-wrap items-center gap-x-1"
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
    >
      <!-- Start/Stop Button -->
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          class={cn(
            "button group/button flex items-center gap-2 rounded-md disabled:border-neutral-900 disabled:bg-transparent hover:disabled:border-neutral-900 hover:disabled:bg-transparent sm:mr-1 sm:border",
            navbarStore.status === "started"
              ? "sm:border-red-500/30 sm:bg-red-700/10 sm:hover:border-red-500/40 sm:hover:bg-red-700/20"
              : "sm:border-green-500/30 sm:bg-green-700/10 sm:hover:border-green-500/40 sm:hover:bg-green-700/20",
          )}
          disabled={navbarStore.status === "editing"}
          onclick={() => navbarStore.status === "stopped" ? recognizerStore.startTeleprompter() : recognizerStore.stopTeleprompter()}
          aria-label={navbarStore.status === "started" ? "Stop" : "Start"}
        >
          {#if navbarStore.status === "stopped" || navbarStore.status === "editing"}
            <Play class={`icon ${navbarStore.status !== "editing" && "green-fill"}`} />
          {:else}
            <Pause class="icon red-fill" />
          {/if}
          <span
            class={cn(
              "hidden pr-1 group-disabled/button:text-neutral-800 sm:inline",
              navbarStore.status === "started"
                ? "pr-1.5 text-red-300/90 group-hover/button:text-red-300"
                : "pr-1 text-green-300/80 group-hover/button:text-green-300/90",
            )}
          >
            {navbarStore.status === "started" ? "Stop " : "Start"}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Content>
          {navbarStore.status === "started" ? "Stop" : "Start"} <kbd>Space</kbd>
        </Tooltip.Content>
      </Tooltip.Root>

      <!-- Edit Button -->
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          class="button"
          onclick={() => {
            navbarStore.toggleEdit();

          }}
          disabled={navbarStore.status === "started"}
          aria-label="Edit Text"
        >
          <Pencil class={`icon ${navbarStore.status === "editing" ? "yellow" : ""}`} />
        </Tooltip.Trigger>
        <Tooltip.Content>
          Edit <kbd>E</kbd>
        </Tooltip.Content>
      </Tooltip.Root>

      <!-- Reset Button -->
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          class="button"
          onclick={handleRestart}
          disabled={navbarStore.status === "editing"}
          aria-label="Reset to Top"
        >
          <Undo2 class="icon" />
        </Tooltip.Trigger>
        <Tooltip.Content>
          Reset to Top <kbd>R</kbd>
        </Tooltip.Content>
      </Tooltip.Root>

      <!-- Clear Button -->
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          class="button"
          onclick={() => {
            if (confirm("Are you sure you want to clear your script?")) {
              contentStore.setText("");
  
            }
          }}
          disabled={navbarStore.status === "started"}
          aria-label="Clear Text"
        >
          <Trash2 class="icon" />
        </Tooltip.Trigger>
        <Tooltip.Content>
          Clear <kbd>Del</kbd>
        </Tooltip.Content>
      </Tooltip.Root>

      <!-- Mirror Button -->
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          class="button"
          onclick={() => navbarStore.toggleMirror()}
          disabled={navbarStore.status === "editing"}
          aria-label="Mirror"
        >
          <MoveHorizontal class={`icon ${navbarStore.mirror ? "yellow" : ""}`} />
        </Tooltip.Trigger>
        <Tooltip.Content>
          Mirror <kbd>M</kbd>
        </Tooltip.Content>
      </Tooltip.Root>

      <!-- Fullscreen Button -->
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          class="button"
          onclick={() => fullscreen.active ? fullscreen.exit() : fullscreen.enter()}
          aria-label={fullscreen.active ? "Exit Fullscreen" : "Fullscreen"}
        >
          <Expand class={`icon ${fullscreen.active ? "yellow" : ""}`} />
        </Tooltip.Trigger>
        <Tooltip.Content>
          {fullscreen.active ? "Exit Fullscreen" : "Fullscreen"} <kbd>F</kbd>
        </Tooltip.Content>
      </Tooltip.Root>

      <!-- Cast Screen Button -->
      {#if !mobileOrTablet}
        <Tooltip.Root>
          <Tooltip.Trigger
            type="button"
            class="button"
            onclick={() => navbarStore.setCast(!navbarStore.cast)}
            aria-label={navbarStore.cast ? "Stop Casting" : "Cast Screen"}
          >
            <MonitorUp class={`icon ${navbarStore.cast ? "yellow" : ""}`} />
          </Tooltip.Trigger>
          <Tooltip.Content>
            {navbarStore.cast ? "Stop Casting" : "Cast Screen"} <kbd>S</kbd>
          </Tooltip.Content>
        </Tooltip.Root>
      {/if}

      <!-- Collaborate Button -->
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          class="button"
          onclick={() => navbarStore.setCollaborate(true)}
          aria-label="Collaborate"
        >
          <UsersRound class={`icon ${collaborateStore.isConnected ? "yellow" : ""}`} />
        </Tooltip.Trigger>
        <Tooltip.Content>
          {collaborateStore.isConnected ? "Connected to Room" : "Collaborate"}
        </Tooltip.Content>
      </Tooltip.Root>
    </div>

    <!-- Timer Section -->
    <div class="flex justify-center text-3xl text-neutral-300 max-[1000px]:hidden">
      <span>{formattedTimer}</span>
    </div>

    <!-- Slider Section -->
    <div
      class="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 text-neutral-300 lg:justify-end"
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
    >
      <!-- Font Size -->
      <Tooltip.Root>
        <Tooltip.Trigger>
          <div class="w-20">
            <DragInput
              bind:value={navbarStore.fontSize}
              step={5}
              min={15}
              max={150}
              aria-label="Font Size"
            >
              <AArrowUp class="size-7" />
            </DragInput>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Content>
          Font Size <span class="text-neutral-400"><kbd>-</kbd><kbd>+</kbd></span>
        </Tooltip.Content>
      </Tooltip.Root>

      <!-- Margin -->
      <Tooltip.Root>
        <Tooltip.Trigger>
          <div class="w-[4.75rem]">
            <DragInput
              bind:value={navbarStore.margin}
              step={2}
              min={0}
              max={44}
              speed={0.5}
              aria-label="Margin"
            >
              <Minimize2 class="size-7 rotate-45" />
            </DragInput>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Content>
          Margin <span class="text-neutral-400"><kbd>{"["}</kbd><kbd>{"]"}</kbd></span>
        </Tooltip.Content>
      </Tooltip.Root>

      <!-- Brightness -->
      <Tooltip.Root>
        <Tooltip.Trigger>
          <div class="w-20">
            <DragInput
              bind:value={navbarStore.opacity}
              step={10}
              min={20}
              max={100}
              aria-label="Brightness"
            >
              <BrightnessIcon />
            </DragInput>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Content>
          Brightness <span class="text-neutral-400"><kbd>;</kbd><kbd>'</kbd></span>
        </Tooltip.Content>
      </Tooltip.Root>

      <!-- Align -->
      <div>
        <Tooltip.Root>
          <Tooltip.Trigger>
            <label
              class="flex gap-1 px-1 focus-within:outline-2 focus-within:outline-blue-500"
              aria-label="Align"
            >
              <TextAlignCenter />
              <select
                class="border-0 focus-visible:outline-0"
                bind:value={navbarStore.align}
              >
                <option class="bg-black" value="top">Top</option>
                <option class="bg-black" value="center">Center</option>
                <option class="bg-black" value="bottom">Bottom</option>
              </select>
            </label>
          </Tooltip.Trigger>
          <Tooltip.Content>
            Align <span class="text-neutral-400"><kbd>T</kbd><kbd>C</kbd><kbd>B</kbd></span>
          </Tooltip.Content>
        </Tooltip.Root>
      </div>
    </div>

    <!-- Hide/Show Toggle Button -->
    <button
      type="button"
      onclick={() => navbarStore.setHide(!navbarStore.hide)}
      aria-label="Toggle navbar visibility"
      class="group absolute -bottom-4 left-1/2 z-20 flex h-8 w-2/3 -translate-x-1/2 translate-y-1/2 justify-center p-1 hover:cursor-pointer focus:outline-0"
    >
      <div class="h-2 w-1/2 rounded-full transition delay-75 group-hover:bg-neutral-700/85 group-focus:bg-neutral-700/85 group-focus:outline-2 group-active:bg-neutral-700/85"></div>
    </button>
  </Tooltip.Provider>
</nav>
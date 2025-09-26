<script lang="ts">
  import { cn } from "@/lib/css";
  import { navbarStore } from "./navbar/store.svelte";
  import { createFullscreen } from "@/app/fullscreen.svelte";

  interface Props {
    class?: string;
  }

  let { class: className, ...restProps }: Props = $props();

  const fullscreen = createFullscreen();
</script>

<div
  class={cn(
    "pointer-events-none fixed z-30 size-full touch-none",
    navbarStore.status === "started" && fullscreen.active
      ? "[box-shadow:inset_0px_0px_0px_0.25rem_rgb(255,0,0)]"
      : "",
    navbarStore.status === "editing" && fullscreen.active
      ? "[box-shadow:inset_0px_0px_0px_0.25rem_rgb(255,255,0)]"
      : "",
    className,
  )}
  {...restProps}
></div>
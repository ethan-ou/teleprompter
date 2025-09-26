<script lang="ts">
  import { contentStore } from "@/features/content/store.svelte";
  import { navbarStore } from "@/features/navbar/store.svelte";
  import { cn } from "@/lib/css";
  import { escape } from "@/lib/html-escaper";
  import { getBoundsStart } from "@/lib/speech-matcher";
  import { getNextWordIndex, type Token } from "@/lib/word-tokenizer";

  interface Props {
    style: Record<string, string | number>;
    lastRef?: HTMLSpanElement;
  }

  let { style, lastRef = $bindable() }: Props = $props();

  // Computed style object and convert to CSS string
  let computedStyleCSS = $derived(
    Object.entries({
      ...style,
      transform: `scaleX(${navbarStore.mirror ? "-1" : "1"})`,
    })
      .map(([key, value]) => `${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${value}`)
      .join('; ')
  );

  function handleTokenClick(index: number) {
    const selectedPosition = index - 1;
    const bounds = getBoundsStart(contentStore.tokens(), selectedPosition);
    contentStore.setPosition({
      start: selectedPosition,
      search: selectedPosition,
      end: selectedPosition,
      ...(bounds !== undefined && {
        bounds: Math.min(bounds, contentStore.tokens.length),
      }),
    });
  }

  function getTokenClassName(token: Token) {
    if (token.index <= contentStore.position().start) {
      return "final-transcript";
    }
    if (token.index <= contentStore.position().end) {
      return "interim-transcript";
    }
    if (navbarStore.status === "started") {
      if (token.index > contentStore.position().bounds + 20) {
        return "opacity-40";
      }
      if (token.index > contentStore.position().bounds + 10) {
        return "opacity-60";
      }
      if (token.index > contentStore.position().bounds) {
        return "opacity-80";
      }
    }
    return "";
  }

  function getTokenHTML(tokenValue: string) {
    return escape(tokenValue).replace(/\n/g, "<br>");
  }

  function handleTokenKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTokenClick(index);
    }
  }
</script>

<div
  class={cn("content select-none", navbarStore.status === "started" ? "content-transition" : "")}
  style={computedStyleCSS}
>
  {#each contentStore.tokens() as token, index (token.index)}
    {@const isLastRef = index === Math.min(getNextWordIndex(contentStore.tokens(), contentStore.position().end), contentStore.tokens().length - 1)}
    {#if isLastRef}
      <span
        bind:this={lastRef}
        class={getTokenClassName(token)}
        onclick={() => handleTokenClick(index)}
        onkeydown={(e) => handleTokenKeydown(e, index)}
        role="button"
        tabindex="0"
      >
        {@html getTokenHTML(token.value)}
      </span>
    {:else}
      <span
        class={getTokenClassName(token)}
        onclick={() => handleTokenClick(index)}
        onkeydown={(e) => handleTokenKeydown(e, index)}
        role="button"
        tabindex="0"
      >
        {@html getTokenHTML(token.value)}
      </span>
    {/if}
  {/each}
</div>
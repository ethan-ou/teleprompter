<script lang="ts">
  import { navbarStore } from "../navbar/store.svelte";
  import { contentStore } from "./store.svelte";
  import { getBoundsStart, resetTranscriptWindow } from "@/lib/speech-matcher";
  import { getNextSentence, getPrevSentence } from "@/lib/word-tokenizer";
  import { scroll } from "@/lib/smooth-scroll";
  import Text from "@/components/Text.svelte";

  let mainRef: HTMLElement;
  let textAreaRef = $state<HTMLTextAreaElement>();
  let textComponent = $state<Text>();
  let isScrolling = $state(false);
  let lastRef = $state<HTMLSpanElement>();

  // Computed style object
  let style = $derived({
    fontSize: `${navbarStore.fontSize}px`,
    paddingLeft: `${navbarStore.margin}vw`,
    // Add more space to the right side for improved readability
    paddingRight: `${navbarStore.margin * 0.8 - Math.min(navbarStore.fontSize / 80, 1) * 0.4}vw`,
    opacity: navbarStore.opacity / 100,
    paddingTop: {
      top: "1rem",
      center: `calc(50vh - ${navbarStore.fontSize * 2}px)`,
      bottom: `calc(${(3 / 4) * 100}vh -  ${navbarStore.fontSize * 2}px)`,
    }[navbarStore.align],
  });

  // Convert to CSS strings
  let styleCSS = $derived(
    Object.entries(style)
      .map(([key, value]) => `${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${value}`)
      .join('; ')
  );

  let textareaStyleCSS = $derived(
    Object.entries({...style, cursor: 'text', overflow: 'hidden'})
      .map(([key, value]) => `${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${value}`)
      .join('; ')
  );

  // Auto-scrolling effect
  $effect(() => {
    if (navbarStore.status === "started") {
      const interval = setInterval(async () => {
        await performScroll();
      }, 2000);
      
      return () => clearInterval(interval);
    } else if (navbarStore.status !== "editing" && !isScrolling) {
      performScroll();
    }
  });

  async function performScroll() {
    if (isScrolling) return;
    
    isScrolling = true;
    try {
      if (lastRef && contentStore.position().end > 0) {
        await scroll({
          top: {
            top: lastRef.offsetTop,
            center:
              lastRef.offsetTop -
              document.documentElement.clientHeight / 2 +
              navbarStore.fontSize * 2,
            bottom:
              lastRef.offsetTop -
              (3 / 4) * document.documentElement.clientHeight +
              navbarStore.fontSize * 2,
          }[navbarStore.align],
          behavior: "smooth",
        });
      } else {
        await scroll({
          top: 0,
          behavior: "smooth",
        });
      }
    } finally {
      isScrolling = false;
    }
  }

  // Keyboard event handlers
  function handleKeyDown(event: KeyboardEvent) {
    // Ctrl+A handler
    if (event.ctrlKey && event.key === 'a') {
      event.preventDefault();
      if (textAreaRef) {
        textAreaRef.focus();
        textAreaRef.select();
      } else if (mainRef) {
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(mainRef);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      return;
    }

    // Escape handler
    if (event.key === 'Escape' && navbarStore.status === "editing") {
      navbarStore.toggleEdit();
      return;
    }

    // Arrow key handlers (only when not editing)
    if (navbarStore.status !== "editing") {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
        const token = getPrevSentence(contentStore.tokens(), contentStore.position().search);
        if (token) {
          const selectedPosition = token.index - 1;
          const boundStart = getBoundsStart(contentStore.tokens(), selectedPosition);
          contentStore.setPosition({
            start: selectedPosition,
            end: selectedPosition,
            search: selectedPosition,
            ...(boundStart !== undefined && { bounds: boundStart }),
          });
          resetTranscriptWindow();
        }
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown') {
        const token = getNextSentence(contentStore.tokens(), contentStore.position().search);
        if (token) {
          const selectedPosition = token.index - 1;
          const boundStart = getBoundsStart(contentStore.tokens(), selectedPosition);
          contentStore.setPosition({
            start: selectedPosition,
            end: selectedPosition,
            search: selectedPosition,
            ...(boundStart !== undefined && { bounds: boundStart }),
          });
          resetTranscriptWindow();
        }
        return;
      }
    }
  }

  function handleTextAreaInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    contentStore.setText(target.value || "");
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<main bind:this={mainRef}>
  {#if navbarStore.status === "editing"}
    <div class="grid grid-cols-1 grid-rows-1">
      <!-- Use an invisible div to force an increase in textarea sizing.
           This should have exactly the same size and properties as the textarea. -->
      <div class="content invisible col-start-1 row-start-1" style={styleCSS}>
        {contentStore.text()}
      </div>
      <textarea
        bind:this={textAreaRef}
        class="content col-start-1 row-start-1"
        style={textareaStyleCSS}
        value={contentStore.text()}
        oninput={handleTextAreaInput}
        placeholder="Enter your content here..."
      ></textarea>
    </div>
  {:else}
    <Text {style} bind:lastRef bind:this={textComponent} />
  {/if}
</main>
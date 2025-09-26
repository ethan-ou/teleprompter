<script lang="ts">
  import { createScreenCapture } from '@/app/screen-capture.svelte';
  import { navbarStore } from '../navbar/store.svelte';
  import { createResizeObserver } from '@/app/resize-observer.svelte';

  let videoElement = $state<HTMLVideoElement>();
  let height = $state(0);

  const screenCapture = createScreenCapture();

  // Watch for cast changes and handle screen capture
  $effect(() => {
    if (navbarStore.cast && !screenCapture.running) {
      screenCapture.start(
        (success) => navbarStore.setCast(success),
        () => navbarStore.setCast(false)
      );
    }
    if (!(navbarStore.cast) && screenCapture.running) {
      screenCapture.stop();
    }
  });

  // Bind video element when it's available
  $effect(() => {
    if (videoElement) {
      screenCapture.bindVideo(videoElement);
    }
  });

  // Handle resize observations
  const updateHeight = () => {
    if (videoElement) {
      const rects = Array.from(videoElement.getClientRects());
      height = rects.reduce((accum, curr) => accum + curr.y, 0);
    }
  };

  // Set up resize observer for document element
  $effect(() => {
    const documentElement = document.documentElement;
    
    const resizeObserver = createResizeObserver({
      onResize: updateHeight,
    });

    const { destroy } = resizeObserver.action(documentElement);

    return destroy;
  });
</script>

<!-- svelte-ignore a11y_media_has_caption -->
<video
  bind:this={videoElement}
  class="fixed z-0 w-full overflow-hidden bg-neutral-950 opacity-50"
  style="height: calc(100vh - {height}px)"
  autoplay
></video>
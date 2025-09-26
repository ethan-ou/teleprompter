export function createScreenCapture() {
  let stream = $state<MediaStream | null>(null);
  let videoElement = $state<HTMLVideoElement | null>(null);

  const running = $derived(stream !== null && stream.active);

  const start = async (
    onSuccess?: (success: boolean) => void,
    onEnd?: (e: Event) => void
  ) => {
    if (running) return;

    try {
      const captureStream = await startCapture();
      if (captureStream) {
        stream = captureStream;
        
        // Set up track end handlers
        captureStream.getTracks().forEach((track) => {
          track.onended = (e) => {
            onEnd?.(e);
            stop();
          };
        });

        // Assign to video element if available
        if (videoElement) {
          videoElement.srcObject = stream;
        }
        
        onSuccess?.(true);
      } else {
        onSuccess?.(false);
      }
    } catch (error) {
      console.error('Screen capture failed:', error);
      onSuccess?.(false);
    }
  };

  const stop = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    if (videoElement) {
      videoElement.srcObject = null;
    }
  };

  // Reactive effect to sync stream with video element
  $effect(() => {
    if (videoElement && stream) {
      videoElement.srcObject = stream;
    }
  });

  return {
    get running() { return running; },
    get stream() { return stream; },
    start,
    stop,
    bindVideo: (element: HTMLVideoElement) => { videoElement = element; }
  };
}

async function startCapture(): Promise<MediaStream | null> {
  try {
    if (!navigator?.mediaDevices?.getDisplayMedia) {
      throw new Error("Screen capture is not available on your device.");
    }
    
    return await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
  } catch (error) {
    if (error instanceof Error) {
      alert(error.message);
    }
    return null;
  }
}
export function createFullscreen(onChange?: (active: boolean) => void) {
  let active = $state(false);
  let element = $state<HTMLElement>(document.documentElement);

  $effect(() => {
    const handleChange = () => {
      const isActive = document.fullscreenElement === element;
      active = isActive;
      onChange?.(isActive);
    };

    document.addEventListener('fullscreenchange', handleChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
    };
  });

  const enter = async () => {
    if (!element) return;

    const keyboardLock = () => {
      if ('keyboard' in navigator && 'lock' in navigator.keyboard) {
        (navigator.keyboard as any).lock(['Escape']);
      }
    };

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      await element.requestFullscreen();
      keyboardLock();
    } else {
      await element.requestFullscreen();
      keyboardLock();
    }
  };

  const exit = async () => {
    if (document.fullscreenElement === element) {
      await document.exitFullscreen();
      if ('keyboard' in navigator && 'unlock' in navigator.keyboard) {
        (navigator.keyboard as any).unlock();
      }
    }
  };

  return {
    get active() { return active; },
    get element() { return element; },
    enter,
    exit
  };
}
<script lang="ts">
  interface Props {
    value: number;
    min?: number | string;
    max?: number | string;
    step?: number | string;
    speed?: number;
    title?: string;
    class?: string;
    [key: string]: any;
  }

  let {
    value = $bindable(),
    min,
    max,
    step,
    speed = 1,
    title,
    class: className = '',
    children,
    ...restProps
  }: Props = $props();

  let inputElement: HTMLInputElement;
  let snapshot = $state(0);
  let startX = $state(0);
  let dragging = $state(false);

  // Helper functions for constraining the value
  const minValue = (val: number, minimum: number | string | undefined) =>
    minimum !== undefined ? Math.max(val, +Number(minimum)) : val;

  const maxValue = (val: number, maximum: number | string | undefined) =>
    maximum !== undefined ? Math.min(val, +Number(maximum)) : val;

  const stepValue = (val: number, stepSize: number | string | undefined) =>
    stepSize !== undefined && +Number(stepSize) !== 0
      ? Math.round(val / +Number(stepSize)) * +Number(stepSize)
      : val;

  const constrain = (val: number) =>
    maxValue(minValue(stepValue(val, step), min), max);

  // Drag handlers
  function handleDragStart(event: PointerEvent) {
    startX = event.clientX;
    snapshot = value;
    dragging = true;
    document.documentElement.style.cursor = 'ew-resize';
    document.body.style.pointerEvents = 'none';
  }

  function handleDragUpdate(event: PointerEvent) {
    if (dragging) {
      value = constrain(snapshot + (event.clientX - startX) * speed);
    }
  }

  function handleDragEnd() {
    dragging = false;
    document.documentElement.style.cursor = '';
    document.body.style.pointerEvents = '';
  }

  // Input field handlers
  function handleInputBlur(event: FocusEvent) {
    const target = event.currentTarget as HTMLInputElement;
    value = constrain(parseInt(target.value, 10) || 0);
  }

  function handleInputKeyup(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      const target = event.currentTarget as HTMLInputElement;
      value = constrain(parseInt(target.value, 10) || 0);
      target.blur();
    }
  }

  function handleInputClick(event: MouseEvent) {
    const target = event.currentTarget as HTMLInputElement;
    target.select();
  }

  function handleInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    value = +target.value;
  }

  // Keyboard navigation for button
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inputElement?.focus();
    }
  }
</script>

<div
  class="flex touch-none items-center gap-2 px-1 py-0.5 align-middle text-lg focus-within:outline-2 focus-within:outline-blue-500 {className}"
  {title}
  onpointermove={handleDragUpdate}
  onpointerup={handleDragEnd}
>
  <button
    type="button"
    class="cursor-ew-resize bg-transparent border-0 p-0"
    onpointerdown={handleDragStart}
    onkeydown={handleKeydown}
    aria-label="Drag to adjust value"
  >
    {@render children?.()}
  </button>
  <input
    bind:this={inputElement}
    bind:value
    type="text"
    inputmode="numeric"
    pattern="[0-9]*"
    {step}
    {min}
    {max}
    spellcheck="false"
    onblur={handleInputBlur}
    onkeyup={handleInputKeyup}
    onclick={handleInputClick}
    oninput={handleInputChange}
    {...restProps}
    class="w-full cursor-default border-0 focus-visible:outline-0"
  />
</div>
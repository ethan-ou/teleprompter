<script lang="ts">
  import { Tooltip as TooltipPrimitive } from "bits-ui";
  import { cn } from "@/lib/css";
  let {
    ref = $bindable(null),
    class: className,
    sideOffset = 10,
    side = "top",
    children,
    arrowClasses,
    ...restProps
  }: TooltipPrimitive.ContentProps & {
    arrowClasses?: string;
  } = $props();
</script>
<TooltipPrimitive.Portal>
  <TooltipPrimitive.Content
    bind:ref
    data-slot="tooltip-content"
    {sideOffset}
    {side}
    class={cn(
      "z-50 flex origin-(--bits-tooltip-content-transform-origin) items-center gap-1 rounded-md bg-neutral-800 px-2 py-1 text-sm outline -outline-offset-1 outline-neutral-700 transition-[transform,scale,opacity] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[instant]:duration-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0",
      className
    )}
    {...restProps}
  >
    {@render children?.()}
    <TooltipPrimitive.Arrow>
      {#snippet child({ props })}
        <div
          class={cn(
            "bg-neutral-800 z-50 size-2.5 rotate-45 rounded-[2px]",
            "data-[side=top]:translate-x-1/2 data-[side=top]:translate-y-[calc(-50%_+_2px)]",
            "data-[side=bottom]:-translate-x-1/2 data-[side=bottom]:-translate-y-[calc(-50%_+_1px)]",
            "data-[side=right]:translate-x-[calc(50%_+_2px)] data-[side=right]:translate-y-1/2",
            "data-[side=left]:-translate-y-[calc(50%_-_3px)]",
            arrowClasses
          )}
          {...props}
        ></div>
      {/snippet}
    </TooltipPrimitive.Arrow>
  </TooltipPrimitive.Content>
</TooltipPrimitive.Portal>
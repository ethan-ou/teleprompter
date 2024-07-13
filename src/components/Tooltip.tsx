import { clsx } from "@/lib/css";

export function TooltipContext({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return <div className={clsx("group/tooltip relative flex", className)} {...props} />;
}

export function Tooltip({
  className,
  position = "top-11",
  ...props
}: { position?: string } & React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={clsx(
        "pointer-events-none absolute z-10 touch-none text-nowrap rounded bg-neutral-800 py-1.5 px-2 text-[0.8rem] text-white opacity-0 transition-all delay-300 group-hover/tooltip:opacity-100 group-aria-disabled/tooltip:hidden",
        position,
        className,
      )}
      {...props}
    />
  );
}

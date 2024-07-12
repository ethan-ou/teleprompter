import { clsx } from "@/lib/css";

export function TooltipContext({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return <div className={clsx("group relative flex", className)} {...props} />;
}

export function Tooltip({
  className,
  top = "top-10",
  ...props
}: { top?: string } & React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={clsx(
        "pointer-events-none absolute z-10 touch-none text-nowrap rounded bg-neutral-800 py-1.5 px-2 text-[0.8rem] text-white opacity-0 transition-all delay-300 group-hover:opacity-100 group-aria-disabled:hidden",
        top,
        className,
      )}
      {...props}
    />
  );
}

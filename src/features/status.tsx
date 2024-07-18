import { clsx } from "@/lib/css";
import { useNavbarStore } from "./navbar/store";
import { useFullScreen } from "@/app/hooks";

export const Status = ({ className, ...props }: React.ComponentPropsWithoutRef<"div">) => {
  const status = useNavbarStore((state) => state.status);
  const fullscreen = useFullScreen();

  return (
    <div
      className={clsx(
        "pointer-events-none fixed z-30 size-full touch-none",
        status === "started" && fullscreen.active
          ? "[box-shadow:inset_0px_0px_0px_0.25rem_rgb(255,0,0)]"
          : "",
        status === "editing" && fullscreen.active
          ? "[box-shadow:inset_0px_0px_0px_0.25rem_rgb(255,255,0)]"
          : "",
        className,
      )}
      {...props}
    />
  );
};

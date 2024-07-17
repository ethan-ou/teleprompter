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
          ? "[box-shadow:inset_0px_0px_0px_5px_rgba(255,0,0,0.3)]"
          : "",
        status === "editing" && fullscreen.active
          ? "[box-shadow:inset_0px_0px_0px_5px_rgba(255,255,0,0.3)]"
          : "",
        className,
      )}
      {...props}
    />
  );
};

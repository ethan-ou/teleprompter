import { useCallback, useEffect, useState, forwardRef, useRef } from "react";

const minValue = (value: number, min: number | string | undefined) =>
  min !== undefined ? Math.max(value, +Number(min)) : value;
const maxValue = (value: number, max: number | string | undefined) =>
  max !== undefined ? Math.min(value, +Number(max)) : value;
const stepValue = (value: number, step: number | string | undefined) =>
  step !== undefined && +Number(step) !== 0
    ? Math.round(value / +Number(step)) * +Number(step)
    : value;

const createConstraints =
  (
    min: number | string | undefined,
    max: number | string | undefined,
    step: number | string | undefined,
  ) =>
  (value: number) =>
    maxValue(minValue(stepValue(value, step), min), max);

export function DragInput({
  value,
  onValueChange,
  min,
  max,
  step,
  children,
  title,
  speed = 1,
  ...props
}: {
  value: number;
  onValueChange: (value: number) => void;
  speed?: number;
} & React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>) {
  const constrain = useCallback(createConstraints(min, max, step), [
    min,
    max,
    step,
  ]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState<boolean>(false);

  // We are creating a snapshot of the values when the drag starts
  // because the [value] will itself change & we need the original
  // [value] to calculate during a drag.
  const [snapshot, setSnapshot] = useState(value);

  // This captures the starting position of the drag and is used to
  // calculate the diff in positions of the cursor.
  const [startValue, setStartValue] = useState(0);

  // Start the drag to change operation when the mouse button is down.
  const onStart = useCallback(
    (event: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
      setStartValue(() => event.clientX);
      setSnapshot(() => value);
      setDragging(() => true);
      document.documentElement.style.cursor = "ew-resize";
      document.body.style.pointerEvents = "none";
    },
    [value, setStartValue, setSnapshot, setDragging],
  );

  // Only change the value if the drag was actually started.
  const onUpdate = useCallback(
    (event: MouseEvent) => {
      if (dragging && startValue) {
        onValueChange(
          constrain(snapshot + (event.clientX - startValue) * speed),
        );
      }
    },
    [dragging, startValue, onValueChange, constrain, snapshot, speed],
  );

  // Stop the drag operation now.
  const onEnd = useCallback(() => {
    setStartValue(() => 0);
    setDragging(() => false);
    document.documentElement.style.cursor = "";
    document.body.style.pointerEvents = "";
  }, [setStartValue, setDragging]);

  // We use document events to update and end the drag operation
  // because the mouse may not be present over the label during
  // the operation..
  useEffect(() => {
    document.addEventListener("pointermove", onUpdate);
    document.addEventListener("pointerup", onEnd);
    return () => {
      document.removeEventListener("pointermove", onUpdate);
      document.removeEventListener("pointerup", onEnd);
    };
  }, [onUpdate, onEnd]);

  return (
    <label
      className="flex touch-none items-center gap-2 py-0.5 px-1 align-middle text-lg focus-within:outline-2 focus-within:outline-blue-500"
      onClick={(e) => e.preventDefault()}
      title={title}
    >
      <span className="cursor-ew-resize" onPointerDown={onStart}>
        {children}
      </span>
      <input
        ref={inputRef}
        value={value}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        step={step}
        min={min}
        max={max}
        autoComplete="false"
        spellCheck="false"
        onBlur={(e) =>
          onValueChange(constrain(parseInt(e.currentTarget.value, 10) || 0))
        }
        onKeyUp={(e) => {
          if (e.key === "Enter") {
            onValueChange(constrain(parseInt(e.currentTarget.value, 10) || 0));
            e.currentTarget.blur();
          }
        }}
        onClick={(e) => e.currentTarget.select()}
        {...props}
        className="w-full cursor-default border-0 focus-visible:outline-0"
      />
    </label>
  );
}

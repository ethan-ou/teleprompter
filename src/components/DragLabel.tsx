import { useCallback, useEffect, useState, forwardRef, useRef } from "react";

const minValue = (value: number, min: number | string | undefined) =>
  min !== undefined ? Math.max(value, +Number(min)) : value;
const maxValue = (value: number, max: number | string | undefined) =>
  max !== undefined ? Math.min(value, +Number(max)) : value;
const stepValue = (value: number, step: number | string | undefined) =>
  step !== undefined && +Number(step) !== 0
    ? Math.round(value / +Number(step)) * +Number(step)
    : value;

export function DragInput({
  value,
  onValueChange,
  min,
  max,
  step,
  children,
  title,
  ...props
}: {
  value: number;
  onValueChange: (value: number) => void;
} & React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>) {
  const inputRef = useRef<HTMLInputElement>(null);

  // We are creating a snapshot of the values when the drag starts
  // because the [value] will itself change & we need the original
  // [value] to calculate during a drag.
  const [snapshot, setSnapshot] = useState(value);

  // This captures the starting position of the drag and is used to
  // calculate the diff in positions of the cursor.
  const [startVal, setStartVal] = useState(0);

  // Start the drag to change operation when the mouse button is down.
  const onStart = useCallback(
    (event: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
      setStartVal(() => event.clientX);
      setSnapshot(() => value);
    },
    [value],
  );

  // We use document events to update and end the drag operation
  // because the mouse may not be present over the label during
  // the operation..
  useEffect(() => {
    // Only change the value if the drag was actually started.
    const onUpdate = (event: MouseEvent) => {
      if (startVal) {
        onValueChange(
          maxValue(
            minValue(stepValue(snapshot + event.clientX - startVal, step), min),
            max,
          ),
        );
      }
    };

    // Stop the drag operation now.
    const onEnd = () => {
      setStartVal(() => 0);
    };

    document.addEventListener("mousemove", onUpdate);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("pointermove", onUpdate);
    document.addEventListener("pointerup", onEnd);
    return () => {
      document.removeEventListener("mousemove", onUpdate);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("pointermove", onUpdate);
      document.removeEventListener("pointerup", onEnd);
    };
  }, [startVal, onValueChange, snapshot]);

  return (
    <label
      className="flex cursor-ew-resize items-center gap-2 py-0.5 px-1 align-middle focus-within:outline-2 focus-within:outline-blue-500"
      onClick={(e) => e.preventDefault()}
      title={title}
    >
      <span onMouseDown={onStart} onPointerDown={onStart}>
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
        onBlur={(e) => onValueChange(parseInt(e.currentTarget.value, 10) || 0)}
        onKeyUp={(e) => {
          if (e.key === "Enter") {
            onValueChange(parseInt(e.currentTarget.value, 10) || 0);
            e.currentTarget.blur();
          }
        }}
        onClick={(e) => e.currentTarget.select()}
        {...props}
        className="w-full border-0 focus-visible:outline-0"
      />
    </label>
  );
}

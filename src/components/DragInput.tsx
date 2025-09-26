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
} & React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) {
  const constrain = useCallback(createConstraints(min, max, step), [min, max, step]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use refs to store the mutable drag state
  const draggingRef = useRef<boolean>(false);
  const startValueRef = useRef<number>(0);
  const snapshotRef = useRef<number>(0);

  const onStart = useCallback(
    (event: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
      // Update ref values directly, no re-render
      draggingRef.current = true;
      startValueRef.current = event.clientX;
      snapshotRef.current = value;
      document.documentElement.style.cursor = "ew-resize";
      document.body.style.pointerEvents = "none";
    },
    [value]
  );

  const onUpdate = useCallback(
    (event: PointerEvent) => {
      if (draggingRef.current) {
        const newDelta = (event.clientX - startValueRef.current) * speed;
        onValueChange(constrain(snapshotRef.current + newDelta));
      }
    },
    [constrain, speed, onValueChange]
  );

  const onEnd = useCallback(() => {
    draggingRef.current = false;
    document.documentElement.style.cursor = "";
    document.body.style.pointerEvents = "";
  }, []);

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
      className="flex touch-none items-center gap-2 px-1 py-0.5 align-middle text-lg focus-within:outline-2 focus-within:outline-blue-500"
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
        onBlur={(e) => onValueChange(constrain(parseInt(e.currentTarget.value, 10) || 0))}
        onKeyUp={(e) => {
          if (e.key === "Enter") {
            onValueChange(constrain(parseInt(e.currentTarget.value, 10) || 0));
            e.currentTarget.blur();
          }
        }}
        onClick={(e) => e.currentTarget.select()}
        onChange={(e) => onValueChange(+e.target.value)}
        {...props}
        className="w-full cursor-default border-0 focus-visible:outline-0"
      />
    </label>
  );
}
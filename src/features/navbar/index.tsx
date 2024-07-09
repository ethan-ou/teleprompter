import { useFullScreen, useInterval } from "@/app/hooks";

import { startTeleprompter, stopTeleprompter } from "@/app/recognizer";
import { useNavbarStore } from "./store";
import { useContentStore } from "../content/store";

import {
  Pencil,
  MoveHorizontal,
  MoveVertical,
  RefreshCw,
  Play,
  Pause,
  Expand,
  Trash2,
  AArrowUp,
  Minimize2,
  Sun,
  AlignCenter,
  SunDim,
  SunMedium,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useHotkeys } from "react-hotkeys-hook";
import { useState } from "react";
import { DragInput } from "@/components/DragInput";

export function Navbar() {
  const {
    status,
    toggleEdit,
    horizontallyFlipped,
    flipHorizontally,
    verticallyFlipped,
    flipVertically,
    fontSize,
    setFontSize,
    margin,
    setMargin,
    opacity,
    setOpacity,
    align,
    setAlign,
    timer,
    incrementTimer,
    resetTimer,
  } = useNavbarStore((state) => state);

  const { setContent, setTextElements, resetTranscriptionIndices } =
    useContentStore(
      useShallow((state) => ({
        setContent: state.setContent,
        setTextElements: state.setTextElements,
        resetTranscriptionIndices: state.resetTranscriptionIndices,
      })),
    );

  const fullscreen = useFullScreen();
  useInterval(() => incrementTimer(), status === "started" ? 1000 : null);

  const [focused, setFocused] = useState(false);

  const startAction = {
    action: () =>
      status === "stopped" ? startTeleprompter() : stopTeleprompter(),
    disabled: status === "editing",
    keys: ["1"],
  };

  useHotkeys(
    "space",
    startAction.action,
    { enabled: !startAction.disabled && !focused, preventDefault: true },
    [startAction.action, focused],
  );
  useActionHotkeys(startAction);

  const editAction = {
    action: () => (toggleEdit(), setTextElements()),
    disabled: status === "started",
    keys: ["e", "2"],
  };
  useActionHotkeys(editAction);

  const clearAction = {
    action: () => {
      if (confirm("Are you sure you want to clear your script?")) {
        setContent("");
        setTextElements();
      }
    },
    disabled: status === "started",
    keys: ["delete", "3"],
  };
  useActionHotkeys(clearAction);

  const horizontallyFlippedAction = {
    action: () => flipHorizontally(),
    disabled: status === "editing",
    keys: ["h", "4"],
  };
  useActionHotkeys(horizontallyFlippedAction);

  const verticallyFlippedAction = {
    action: () => flipVertically(),
    disabled: status === "editing",
    keys: ["v", "5"],
  };
  useActionHotkeys(verticallyFlippedAction);

  const fullscreenAction = {
    action: () => (fullscreen.active ? fullscreen.exit() : fullscreen.enter()),
    disabled: false,
    keys: ["f", "6"],
  };
  useActionHotkeys(fullscreenAction);

  const restartAction = {
    action: () => (
      resetTranscriptionIndices(),
      resetTimer(),
      window.scrollTo({ top: 0, behavior: "smooth" })
    ),
    disabled: status === "started",
    keys: ["r", "7"],
  };
  useActionHotkeys(restartAction);

  const sizeSlider = {
    step: 5,
    min: 15,
    max: 150,
    value: fontSize,
    action: setFontSize,
    incrementKeys: ["s+Equal", "shift+Equal", "ctrl+shift+period"],
    decrementKeys: ["s+Minus", "shift+Minus", "ctrl+shift+comma"],
  };
  useSliderHotkeys(sizeSlider);

  const marginSlider = {
    step: 2,
    min: 0,
    max: 36,
    value: margin,
    action: setMargin,
    incrementKeys: ["m+Equal", "shift+BracketRight"],
    decrementKeys: ["m+Minus", "shift+BracketLeft"],
  };
  useSliderHotkeys(marginSlider);

  const contrastSlider = {
    step: 10,
    min: 20,
    max: 100,
    value: opacity,
    action: setOpacity,
    incrementKeys: ["c+Equal", "shift+Quote"],
    decrementKeys: ["c+Minus", "shift+Semicolon"],
  };
  useSliderHotkeys(contrastSlider);

  useHotkeys("t", () => setAlign("top"));
  useHotkeys("c", () => setAlign("center"));

  return (
    <nav
      role="navigation"
      aria-label="main navigation"
      className="sticky top-0 z-10 flex w-full flex-wrap items-center justify-evenly gap-x-4 border-b border-neutral-800 bg-neutral-950/90 py-1 px-2 text-white backdrop-blur select-none lg:justify-between xl:grid xl:grid-cols-[3fr_1fr_3fr]"
    >
      <div
        style={{ alignItems: "center", display: "flex", columnGap: "0.25rem" }}
        onFocus={() => setFocused(() => true)}
        onBlur={() => setFocused(() => false)}
      >
        <button
          className="button"
          disabled={startAction.disabled}
          onClick={startAction.action}
          title={
            status === "stopped" || status === "editing"
              ? "Start (space)"
              : "Stop (space)"
          }
        >
          {status === "stopped" || status === "editing" ? (
            <Play className={`icon ${status !== "editing" && "green-fill"}`} />
          ) : (
            <Pause className="icon red-fill" />
          )}
        </button>
        <button
          className="button"
          onClick={editAction.action}
          disabled={editAction.disabled}
          title="Edit (e)"
        >
          <Pencil className={`icon ${status === "editing" ? "yellow" : ""}`} />
        </button>
        <button
          className="button"
          onClick={clearAction.action}
          disabled={clearAction.disabled}
          title="Clear (del)"
        >
          <Trash2 className="icon" />
        </button>
        <button
          className="button"
          onClick={horizontallyFlippedAction.action}
          disabled={horizontallyFlippedAction.disabled}
          title="Flip Text Horizontally (h)"
        >
          <MoveHorizontal
            className={`icon ${horizontallyFlipped ? "yellow" : ""}`}
          />
        </button>
        <button
          className="button"
          onClick={verticallyFlippedAction.action}
          disabled={verticallyFlippedAction.disabled}
          title="Flip Text Vertically (v)"
        >
          <MoveVertical
            className={`icon ${verticallyFlipped ? "yellow" : ""}`}
          />
        </button>
        <button
          className="button"
          onClick={fullscreenAction.action}
          disabled={fullscreenAction.disabled}
          title={fullscreen.active ? "Exit Fullscreen (f)" : "Fullscreen (f)"}
        >
          <Expand className={`icon ${fullscreen.active ? "yellow" : ""}`} />
        </button>
        <button
          className="button"
          onClick={restartAction.action}
          disabled={restartAction.disabled}
          title="Restart From Beginning (r)"
        >
          <RefreshCw className="icon" />
        </button>
      </div>
      <div className="flex justify-center text-3xl text-neutral-300">
        <span>
          {Math.floor(timer / (60 * 60))
            .toString()
            .padStart(2, "0")}
          :
          {Math.floor(timer / 60)
            .toString()
            .padStart(2, "0")}
          :{(timer % 60).toString().padStart(2, "0")}
        </span>
      </div>
      <div
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 text-neutral-300 lg:justify-end"
        onFocus={() => setFocused(() => true)}
        onBlur={() => setFocused(() => false)}
      >
        <div className="w-20">
          <DragInput
            value={sizeSlider.value}
            onValueChange={sizeSlider.action}
            step={sizeSlider.step}
            min={sizeSlider.min}
            max={sizeSlider.max}
            title="Font Size (shift+= shift+-)"
          >
            <AArrowUp />
          </DragInput>
        </div>
        <div className="w-20">
          <DragInput
            value={marginSlider.value}
            onValueChange={marginSlider.action}
            step={marginSlider.step}
            min={marginSlider.min}
            max={marginSlider.max}
            title="Margin (shift+] shift+[)"
          >
            <Minimize2 className="rotate-45" />
          </DragInput>
        </div>
        <div className="w-20">
          <DragInput
            value={contrastSlider.value}
            onValueChange={contrastSlider.action}
            step={contrastSlider.step}
            min={contrastSlider.min}
            max={contrastSlider.max}
            title="Brightness (shift+' shift+;)"
          >
            {contrastSlider.value > 80 ? (
              <Sun />
            ) : contrastSlider.value > 50 ? (
              <SunMedium />
            ) : (
              <SunDim />
            )}
          </DragInput>
        </div>
        <div>
          <label
            className="flex gap-1 py-0.5 px-1 focus-within:outline-2 focus-within:outline-blue-500"
            title="Align (t/c)"
          >
            <AlignCenter />
            <select
              className="border-0 focus-visible:outline-0"
              onChange={(e) => {
                const value = e.target.value;
                if (value === "top" || value === "center") {
                  setAlign(value);
                }
              }}
              value={align}
            >
              <option className="bg-black" value="top">
                Top
              </option>
              <option className="bg-black" value="center">
                Center
              </option>
            </select>
          </label>
        </div>
      </div>
    </nav>
  );
}

function useActionHotkeys({
  action,
  disabled,
  keys,
}: {
  action: () => void;
  disabled: boolean;
  keys: string[];
}) {
  useHotkeys(keys, action, { enabled: !disabled }, [action, disabled]);
}

function useSliderHotkeys({
  step,
  min,
  max,
  value,
  action,
  incrementKeys,
  decrementKeys,
}: {
  step: number;
  min: number;
  max: number;
  value: number;
  action: (value: number) => void;
  incrementKeys: string[];
  decrementKeys: string[];
}) {
  useHotkeys(
    incrementKeys,
    () => action(value + step <= max ? value + step : value),
    [incrementKeys, action, value, step, max],
  );
  useHotkeys(
    decrementKeys,
    () => action(value - step >= min ? value - step : value),
    [decrementKeys, action, value, step, max],
  );
}

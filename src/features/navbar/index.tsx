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

import { useHotkeys } from "react-hotkeys-hook";
import { useState } from "react";
import { DragInput } from "@/components/DragInput";
import { Tooltip, TooltipContext } from "@/components/Tooltip";

export function Navbar() {
  const [focused, setFocused] = useState(false);
  const [hideNavbar, setHideNavbar] = useState(false);
  useHotkeys("shift+h", () => {
    setHideNavbar((prev) => !prev);
  });

  return (
    <nav
      role="navigation"
      aria-label="main navigation"
      className="sticky top-0 z-10 flex w-full flex-wrap items-center justify-evenly gap-x-4 border-b border-neutral-800 bg-neutral-950/90 py-1 px-2 text-white backdrop-blur select-none min-[850px]:justify-between min-[1075px]:grid min-[1075px]:grid-cols-[3fr_1fr_3fr]"
      {...(hideNavbar && { style: { display: "none" } })}
    >
      <div
        className="flex flex-wrap items-center gap-x-1"
        onFocus={() => setFocused(() => true)}
        onBlur={() => setFocused(() => false)}
      >
        <ButtonSection focused={focused} />
      </div>
      <div className="flex justify-center text-3xl text-neutral-300 max-[480px]:hidden">
        <TimerSection />
      </div>
      <div
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 text-neutral-300 lg:justify-end"
        onFocus={() => setFocused(() => true)}
        onBlur={() => setFocused(() => false)}
      >
        <SliderSection />
      </div>
    </nav>
  );
}

function ButtonSection({ focused }: { focused: boolean }) {
  const { status, toggleEdit, mirror, toggleMirror, resetTimer } = useNavbarStore((state) => state);

  const setContent = useContentStore((state) => state.setContent);
  const setTokens = useContentStore((state) => state.setTokens);
  const resetPosition = useContentStore((state) => state.resetPosition);

  const fullscreen = useFullScreen();

  const startAction = {
    action: () => (status === "stopped" ? startTeleprompter() : stopTeleprompter()),
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
    action: () => (toggleEdit(), setTokens()),
    disabled: status === "started",
    keys: ["e", "2"],
  };
  useActionHotkeys(editAction);

  const clearAction = {
    action: () => {
      if (confirm("Are you sure you want to clear your script?")) {
        setContent("");
        setTokens();
      }
    },
    disabled: status === "started",
    keys: ["delete", "3"],
  };
  useActionHotkeys(clearAction);

  const mirrorAction = {
    action: () => toggleMirror(),
    disabled: status === "editing",
    keys: ["m", "4"],
  };
  useActionHotkeys(mirrorAction);

  const fullscreenAction = {
    action: () => (fullscreen.active ? fullscreen.exit() : fullscreen.enter()),
    disabled: false,
    keys: ["f", "5"],
  };
  useActionHotkeys(fullscreenAction);

  const restartAction = {
    action: () => (resetPosition(), resetTimer(), window.scrollTo({ top: 0, behavior: "smooth" })),
    disabled: status === "started",
    keys: ["r", "6"],
  };
  useActionHotkeys(restartAction);

  return (
    <>
      <TooltipContext aria-disabled={startAction.disabled}>
        <button
          className="button"
          disabled={startAction.disabled}
          onClick={startAction.action}
          aria-label={status === "started" ? "Stop" : "Start"}
        >
          {status === "stopped" || status === "editing" ? (
            <Play className={`icon ${status !== "editing" && "green-fill"}`} />
          ) : (
            <Pause className="icon red-fill" />
          )}
        </button>
        <Tooltip>
          {status === "started" ? "Stop" : "Start"} <kbd>Space</kbd>
        </Tooltip>
      </TooltipContext>
      <TooltipContext aria-disabled={editAction.disabled}>
        <button
          className="button"
          onClick={editAction.action}
          disabled={editAction.disabled}
          aria-label="Edit Text"
        >
          <Pencil className={`icon ${status === "editing" ? "yellow" : ""}`} />
        </button>
        <Tooltip>
          Edit <kbd>E</kbd>
        </Tooltip>
      </TooltipContext>
      <TooltipContext aria-disabled={clearAction.disabled}>
        <button
          className="button"
          onClick={clearAction.action}
          disabled={clearAction.disabled}
          aria-label="Clear Text"
        >
          <Trash2 className="icon" />
        </button>
        <Tooltip>
          Clear <kbd>Del</kbd>
        </Tooltip>
      </TooltipContext>
      <TooltipContext aria-disabled={mirrorAction.disabled}>
        <button
          className="button"
          onClick={mirrorAction.action}
          disabled={mirrorAction.disabled}
          aria-label="Mirror"
        >
          <MoveHorizontal className={`icon ${mirror ? "yellow" : ""}`} />
        </button>
        <Tooltip>
          Mirror <kbd>M</kbd>
        </Tooltip>
      </TooltipContext>
      <TooltipContext aria-disabled={fullscreenAction.disabled}>
        <button
          className="button"
          onClick={fullscreenAction.action}
          disabled={fullscreenAction.disabled}
          aria-label={fullscreen.active ? "Exit Fullscreen (f)" : "Fullscreen (f)"}
        >
          <Expand className={`icon ${fullscreen.active ? "yellow" : ""}`} />
        </button>
        <Tooltip>
          {fullscreen.active ? "Exit Fullscreen" : "Fullscreen"} <kbd>F</kbd>
        </Tooltip>
      </TooltipContext>
      <TooltipContext aria-disabled={restartAction.disabled}>
        <button
          className="button"
          onClick={restartAction.action}
          disabled={restartAction.disabled}
          aria-label="Reset to Top"
        >
          <RefreshCw className="icon" />
        </button>
        <Tooltip>
          Reset to Top <kbd>R</kbd>
        </Tooltip>
      </TooltipContext>
    </>
  );
}

function TimerSection() {
  const status = useNavbarStore((state) => state.status);
  const timer = useNavbarStore((state) => state.timer);
  const incrementTimer = useNavbarStore((state) => state.incrementTimer);

  useInterval(() => incrementTimer(), status === "started" ? 1000 : null);

  return (
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
  );
}

function SliderSection() {
  const { fontSize, setFontSize, margin, setMargin, opacity, setOpacity, align, setAlign } =
    useNavbarStore((state) => state);

  const sizeSlider = {
    step: 5,
    min: 15,
    max: 150,
    value: fontSize,
    action: setFontSize,
    incrementKeys: ["shift+Equal", "ctrl+shift+period"],
    decrementKeys: ["shift+Minus", "ctrl+shift+comma"],
  };
  useSliderHotkeys(sizeSlider);

  const marginSlider = {
    step: 2,
    min: 0,
    max: 36,
    value: margin,
    action: setMargin,
    incrementKeys: ["shift+BracketRight"],
    decrementKeys: ["shift+BracketLeft"],
  };
  useSliderHotkeys(marginSlider);

  const contrastSlider = {
    step: 10,
    min: 20,
    max: 100,
    value: opacity,
    action: setOpacity,
    incrementKeys: ["shift+Quote"],
    decrementKeys: ["shift+Semicolon"],
  };
  useSliderHotkeys(contrastSlider);

  useHotkeys("t", () => setAlign("top"));
  useHotkeys("c", () => setAlign("center"));

  return (
    <>
      <TooltipContext>
        <div className="w-20">
          <DragInput
            value={sizeSlider.value}
            onValueChange={sizeSlider.action}
            step={sizeSlider.step}
            min={sizeSlider.min}
            max={sizeSlider.max}
            aria-label="Font Size"
          >
            <AArrowUp />
          </DragInput>
        </div>
        <Tooltip top="top-9">Font Size</Tooltip>
      </TooltipContext>
      <TooltipContext>
        <div className="w-20">
          <DragInput
            value={marginSlider.value}
            onValueChange={marginSlider.action}
            step={marginSlider.step}
            min={marginSlider.min}
            max={marginSlider.max}
            aria-label="Margin"
          >
            <Minimize2 className="rotate-45" />
          </DragInput>
        </div>
        <Tooltip top="top-9">Margin</Tooltip>
      </TooltipContext>
      <TooltipContext>
        <div className="w-20">
          <DragInput
            value={contrastSlider.value}
            onValueChange={contrastSlider.action}
            step={contrastSlider.step}
            min={contrastSlider.min}
            max={contrastSlider.max}
            aria-label="Brightness"
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
        <Tooltip top="top-9">Brightness</Tooltip>
      </TooltipContext>
      <div>
        <label
          className="flex gap-1 px-1 focus-within:outline-2 focus-within:outline-blue-500"
          aria-label="Align"
        >
          <TooltipContext>
            <AlignCenter />
            <Tooltip top="top-[2.1rem]">
              Align{" "}
              <span className="text-neutral-400">
                <kbd>T</kbd> or <kbd>C</kbd>
              </span>
            </Tooltip>
          </TooltipContext>
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
    </>
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
  useHotkeys(incrementKeys, () => action(value + step <= max ? value + step : value), [
    incrementKeys,
    action,
    value,
    step,
    max,
  ]);
  useHotkeys(decrementKeys, () => action(value - step >= min ? value - step : value), [
    decrementKeys,
    action,
    value,
    step,
    max,
  ]);
}

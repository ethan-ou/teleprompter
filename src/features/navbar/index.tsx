import { useFullScreen } from "@/app/hooks";
import { startTeleprompter, stopTeleprompter } from "@/app/recognizer";
import { Align, useNavbarStore } from "./store";
import { useContentStore } from "../content/store";
import { useInterval } from "@/app/hooks";

import {
  Pencil,
  MoveHorizontal,
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
  EyeOff,
  Airplay,
  Undo2,
} from "lucide-react";

import { useHotkeys } from "react-hotkeys-hook";
import { useState } from "react";
import { DragInput } from "@/components/DragInput";
import { Tooltip, TooltipContext } from "@/components/Tooltip";
import { clsx } from "@/lib/css";

export function Navbar() {
  const [focused, setFocused] = useState(false);
  const hide = useNavbarStore((state) => state.hide);

  return (
    <nav
      role="navigation"
      aria-label="main navigation"
      className={clsx(
        "top-0 z-10 flex w-full flex-wrap items-center justify-evenly gap-x-4 border-b border-neutral-800 bg-neutral-950/90 py-2 px-3 text-white backdrop-blur transition delay-200 duration-300 ease-in select-none hover:opacity-100 min-[975px]:justify-between min-[1075px]:grid min-[1075px]:grid-cols-[3fr_1fr_3fr]",
        hide ? "fixed opacity-0 hover:opacity-100 active:opacity-100" : "sticky opacity-100",
      )}
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
  const { status, toggleEdit, mirror, toggleMirror, resetTimer, hide, toggleHide, cast, setCast } =
    useNavbarStore((state) => state);

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

  const hideAction = {
    action: () => toggleHide(),
    disabled: status === "editing",
    keys: ["h", "6"],
  };
  useActionHotkeys(hideAction);

  const castScreenAction = {
    action: () => setCast(!cast),
    disabled: false,
    keys: ["s", "7"],
  };
  useActionHotkeys(castScreenAction);

  const restartAction = {
    action: () => (resetPosition(), resetTimer(), window.scrollTo({ top: 0, behavior: "smooth" })),
    disabled: status !== "stopped",
    keys: ["r", "8"],
  };
  useActionHotkeys(restartAction);

  return (
    <>
      <TooltipContext aria-disabled={startAction.disabled}>
        <button
          className={clsx(
            "button group/button mr-1 flex items-center gap-2 rounded-lg border disabled:border-neutral-900 disabled:bg-transparent",
            status === "started"
              ? "border-red-500/30 bg-red-700/10 hover:border-red-500/40 hover:bg-red-700/20"
              : "border-green-500/30 bg-green-700/10 hover:border-green-500/40 hover:bg-green-700/20",
          )}
          disabled={startAction.disabled}
          onClick={startAction.action}
          aria-label={status === "started" ? "Stop" : "Start"}
        >
          {status === "stopped" || status === "editing" ? (
            <Play className={`icon ${status !== "editing" && "green-fill"}`} />
          ) : (
            <Pause className="icon red-fill" />
          )}
          <span
            className={clsx(
              "pr-1 group-disabled/button:text-neutral-800",
              status === "started"
                ? "pr-1.5 text-red-300/90 group-hover/button:text-red-300"
                : "pr-1 text-green-300/80 group-hover/button:text-green-300/90",
            )}
          >
            {status === "started" ? "Stop " : "Start"}
          </span>
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
          aria-label={fullscreen.active ? "Exit Fullscreen" : "Fullscreen"}
        >
          <Expand className={`icon ${fullscreen.active ? "yellow" : ""}`} />
        </button>
        <Tooltip>
          {fullscreen.active ? "Exit Fullscreen" : "Fullscreen"} <kbd>F</kbd>
        </Tooltip>
      </TooltipContext>
      <TooltipContext aria-disabled={hideAction.disabled}>
        <button
          className="button"
          onClick={hideAction.action}
          disabled={hideAction.disabled}
          aria-label={hide ? "Hide Menu" : "Show Menu"}
        >
          <EyeOff className={`icon ${hide ? "yellow" : ""}`} />
        </button>
        <Tooltip>
          Hide Menu <kbd>H</kbd>
        </Tooltip>
      </TooltipContext>
      <TooltipContext aria-disabled={castScreenAction.disabled}>
        <button
          className="button"
          onClick={castScreenAction.action}
          disabled={castScreenAction.disabled}
          aria-label={cast ? "Stop Casting" : "Cast Screen"}
        >
          <Airplay className={`icon ${cast ? "yellow" : ""}`} />
        </button>
        <Tooltip>
          {cast ? "Stop Casting" : "Cast Screen"} <kbd>S</kbd>
        </Tooltip>
      </TooltipContext>
      <TooltipContext aria-disabled={restartAction.disabled}>
        <button
          className="button"
          onClick={restartAction.action}
          disabled={restartAction.disabled}
          aria-label="Reset to Top"
        >
          <Undo2 className="icon" />
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
    incrementKeys: ["Equal", "ctrl+shift+period"],
    decrementKeys: ["Minus", "ctrl+shift+comma"],
  };
  useSliderHotkeys(sizeSlider);

  const marginSlider = {
    step: 2,
    min: 0,
    max: 40,
    value: margin,
    action: setMargin,
    incrementKeys: ["BracketRight"],
    decrementKeys: ["BracketLeft"],
  };
  useSliderHotkeys(marginSlider);

  const contrastSlider = {
    step: 10,
    min: 20,
    max: 100,
    value: opacity,
    action: setOpacity,
    incrementKeys: ["Quote"],
    decrementKeys: ["Semicolon"],
  };
  useSliderHotkeys(contrastSlider);

  useHotkeys("t", () => setAlign("top"));
  useHotkeys("c", () => setAlign("center"));
  useHotkeys("b", () => setAlign("bottom"));

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
            <AArrowUp className="size-7" />
          </DragInput>
        </div>
        <Tooltip>
          Font Size{" "}
          <span className="text-neutral-400">
            <kbd>-</kbd>
            <kbd>+</kbd>
          </span>
        </Tooltip>
      </TooltipContext>
      <TooltipContext>
        <div className="w-[4.75rem]">
          <DragInput
            value={marginSlider.value}
            onValueChange={marginSlider.action}
            step={marginSlider.step}
            min={marginSlider.min}
            max={marginSlider.max}
            aria-label="Margin"
          >
            <Minimize2 className="size-7 rotate-45" />
          </DragInput>
        </div>
        <Tooltip>
          Margin{" "}
          <span className="text-neutral-400">
            <kbd>{"["}</kbd>
            <kbd>{"]"}</kbd>
          </span>
        </Tooltip>
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
        <Tooltip>
          Brightness{" "}
          <span className="text-neutral-400">
            <kbd>;</kbd>
            <kbd>'</kbd>
          </span>
        </Tooltip>
      </TooltipContext>
      <div>
        <label
          className="flex gap-1 px-1 focus-within:outline-2 focus-within:outline-blue-500"
          aria-label="Align"
        >
          <TooltipContext>
            <AlignCenter />
            <Tooltip>
              Align{" "}
              <span className="text-neutral-400">
                <kbd>T</kbd>
                <kbd>C</kbd>
                <kbd>B</kbd>
              </span>
            </Tooltip>
          </TooltipContext>
          <select
            className="border-0 focus-visible:outline-0"
            onChange={(e) => setAlign(e.target.value as Align)}
            value={align}
          >
            <option className="bg-black" value="top">
              Top
            </option>
            <option className="bg-black" value="center">
              Center
            </option>
            <option className="bg-black" value="bottom">
              Bottom
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

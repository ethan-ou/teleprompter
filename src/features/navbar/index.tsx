import { useFullScreen } from "@/app/hooks";
import { startTeleprompter, stopTeleprompter } from "@/app/recognizer";
import { Align, useNavbarStore } from "./store";
import { useContent } from "../content/store";
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
  Undo2,
  MonitorUp,
  UsersRound,
} from "lucide-react";

import { useHotkeys } from "react-hotkeys-hook";
import { useState } from "react";
import { DragInput } from "@/components/DragInput";
import { Tooltip, TooltipContext } from "@/components/Tooltip";
import { clsx } from "@/lib/css";
import { isMobileOrTablet } from "@/lib/device";
import { getBoundsStart, resetTranscriptWindow } from "@/lib/speech-matcher";
import { Dialog, Input, Tabs } from "@base-ui-components/react";
import { Collaborate } from "../collaborate";

const mobileOrTablet = isMobileOrTablet();

export function Navbar() {
  const [focused, setFocused] = useState(false);
  const hide = useNavbarStore((state) => state.hide);
  const setHide = useNavbarStore((state) => state.setHide);

  return (
    <nav
      role="navigation"
      aria-label="main navigation"
      className={clsx(
        "top-0 z-10 flex w-full flex-wrap items-center justify-evenly gap-x-4 gap-y-1 border-b border-neutral-800 bg-neutral-950/90 px-3 py-2 text-white backdrop-blur transition select-none hover:opacity-100 min-[925px]:justify-between",
        hide ? "fixed -translate-y-full" : "sticky translate-y-0",
      )}
    >
      <div
        className="flex flex-wrap items-center gap-x-1"
        onFocus={() => setFocused(() => true)}
        onBlur={() => setFocused(() => false)}
      >
        <ButtonSection focused={focused} />
      </div>
      <div className="flex justify-center text-3xl text-neutral-300 max-[1000px]:hidden">
        <TimerSection />
      </div>
      <div
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 text-neutral-300 lg:justify-end"
        onFocus={() => setFocused(() => true)}
        onBlur={() => setFocused(() => false)}
      >
        <SliderSection />
      </div>
      <button
        type="button"
        onClick={() => setHide(!hide)}
        className="group absolute -bottom-4 left-1/2 z-20 flex h-8 w-2/3 -translate-x-1/2 translate-y-1/2 justify-center p-1 hover:cursor-pointer focus:outline-0"
      >
        <div className="h-2 w-1/2 rounded-full transition delay-75 group-hover:bg-neutral-700/85 group-focus:bg-neutral-700/85 group-focus:outline-2 group-active:bg-neutral-700/85"></div>
      </button>
    </nav>
  );
}

function ButtonSection({ focused }: { focused: boolean }) {
  const { status, toggleEdit, mirror, toggleMirror, resetTimer, hide, setHide, cast, setCast } =
    useNavbarStore((state) => state);

  const { setText: setContent, tokens, setTokens, setPosition } = useContent();

  const fullscreen = useFullScreen((active) => setHide(active));

  const startAction = {
    action: () => (status === "stopped" ? startTeleprompter() : stopTeleprompter()),
    disabled: status === "editing",
    keys: [],
  };

  useHotkeys(
    "space",
    startAction.action,
    { enabled: !startAction.disabled && !focused, preventDefault: true },
    [startAction.action, focused],
  );

  useHotkeys(
    "esc",
    startAction.action,
    {
      enabled: status === "started",
    },
    [status, stopTeleprompter],
  );

  const editAction = {
    action: () => (toggleEdit(), setTokens()),
    disabled: status === "started",
    keys: ["e"],
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
    keys: ["delete"],
  };
  useActionHotkeys(clearAction);

  const mirrorAction = {
    action: () => toggleMirror(),
    disabled: status === "editing",
    keys: ["m"],
  };
  useActionHotkeys(mirrorAction);

  const fullscreenAction = {
    action: () => (fullscreen.active ? fullscreen.exit() : fullscreen.enter()),
    disabled: false,
    keys: ["f"],
  };
  useActionHotkeys(fullscreenAction);

  const hideAction = {
    action: () => setHide(!hide),
    disabled: false,
    keys: ["h"],
  };
  useActionHotkeys(hideAction);

  const castScreenAction = {
    action: () => setCast(!cast),
    disabled: false,
    keys: ["s"],
  };
  useActionHotkeys(castScreenAction);

  const restartAction = {
    action: () => {
      const selectedPosition = -1;
      const boundStart = getBoundsStart(tokens, 0);
      setPosition({
        start: selectedPosition,
        end: selectedPosition,
        search: selectedPosition,
        ...(boundStart !== undefined && { bounds: boundStart }),
      });
      resetTimer();
      resetTranscriptWindow();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    disabled: status === "editing",
    keys: ["r"],
  };
  useActionHotkeys(restartAction);

  // const collaborateAction = {
  //   action: () => {
  //     setCollaborate(!collaborate);
  //   },
  //   disabled: false,
  //   keys: [""],
  // };

  return (
    <>
      <TooltipContext aria-disabled={startAction.disabled || mobileOrTablet}>
        <button
          type="button"
          className={clsx(
            "button group/button flex items-center gap-2 rounded-md disabled:border-neutral-900 disabled:bg-transparent hover:disabled:border-neutral-900 hover:disabled:bg-transparent sm:mr-1 sm:border",
            status === "started"
              ? "sm:border-red-500/30 sm:bg-red-700/10 sm:hover:border-red-500/40 sm:hover:bg-red-700/20"
              : "sm:border-green-500/30 sm:bg-green-700/10 sm:hover:border-green-500/40 sm:hover:bg-green-700/20",
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
              "hidden pr-1 group-disabled/button:text-neutral-800 sm:inline",
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
      <TooltipContext aria-disabled={editAction.disabled || mobileOrTablet}>
        <button
          type="button"
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
      <TooltipContext aria-disabled={restartAction.disabled || mobileOrTablet}>
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
      <TooltipContext aria-disabled={clearAction.disabled || mobileOrTablet}>
        <button
          type="button"
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
      <TooltipContext aria-disabled={mirrorAction.disabled || mobileOrTablet}>
        <button
          type="button"
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
      <TooltipContext aria-disabled={fullscreenAction.disabled || mobileOrTablet}>
        <button
          type="button"
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
      {!mobileOrTablet && (
        <TooltipContext aria-disabled={castScreenAction.disabled || mobileOrTablet}>
          <button
            className="button"
            onClick={castScreenAction.action}
            disabled={castScreenAction.disabled}
            aria-label={cast ? "Stop Casting" : "Cast Screen"}
          >
            <MonitorUp className={`icon ${cast ? "yellow" : ""}`} />
          </button>
          <Tooltip>
            {cast ? "Stop Casting" : "Cast Screen"} <kbd>S</kbd>
          </Tooltip>
        </TooltipContext>
      )}
      <Collaborate />
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
      {Math.floor((timer / 60) % 60)
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
    max: 44,
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
      <TooltipContext aria-disabled={mobileOrTablet}>
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
      <TooltipContext aria-disabled={mobileOrTablet}>
        <div className="w-[4.75rem]">
          <DragInput
            value={marginSlider.value}
            onValueChange={marginSlider.action}
            step={marginSlider.step}
            min={marginSlider.min}
            max={marginSlider.max}
            speed={0.5}
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
      <TooltipContext aria-disabled={mobileOrTablet}>
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
          <TooltipContext aria-disabled={mobileOrTablet}>
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

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
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useHotkeys } from "react-hotkeys-hook";
import { useState } from "react";

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
    timer,
    incrementTimer,
    resetTimer,
  } = useNavbarStore((state) => state);

  const { setContent, setTextElements, resetTranscriptionIndices } = useContentStore(
    useShallow((state) => ({
      setContent: state.setContent,
      setTextElements: state.setTextElements,
      resetTranscriptionIndices: state.resetTranscriptionIndices,
    }))
  );

  const fullscreen = useFullScreen();
  useInterval(() => incrementTimer(), status === "started" ? 1000 : null);

  const [focused, setFocused] = useState(false);

  const startAction = {
    action: () => (status === "stopped" ? startTeleprompter() : stopTeleprompter()),
    disabled: status === "editing",
    keys: ["1"],
  };

  useHotkeys("space", startAction.action, { enabled: !startAction.disabled && !focused }, [
    startAction.action,
    focused,
  ]);
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
    action: () => (resetTranscriptionIndices(), resetTimer()),
    disabled: status === "started",
    keys: ["r", "7"],
  };
  useActionHotkeys(restartAction);

  return (
    <nav
      role="navigation"
      aria-label="main navigation"
      className="navbar"
      style={{
        color: "white",
        borderBottom: "solid 1px #222",
        padding: "0.25rem 0.5rem",
        columnGap: "1rem",
        width: "100%",
        alignItems: "center",
      }}
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
          title={status === "stopped" || status === "editing" ? "Start (space)" : "Stop (space)"}
        >
          <span className="icon">
            {status === "stopped" || status === "editing" ? (
              <Play className={`icon ${status !== "editing" && "green-fill"}`} />
            ) : (
              <Pause className="icon red-fill" />
            )}
          </span>
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
          <MoveHorizontal className={`icon ${horizontallyFlipped ? "yellow" : ""}`} />
        </button>
        <button
          className="button"
          onClick={verticallyFlippedAction.action}
          disabled={verticallyFlippedAction.disabled}
          title="Flip Text Vertically (v)"
        >
          <MoveVertical className={`icon ${verticallyFlipped ? "yellow" : ""}`} />
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
          title="Restart from the beginning (r)"
        >
          <RefreshCw className="icon" />
        </button>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          color: "#ccc",
          fontSize: "2rem",
          userSelect: "none",
        }}
      >
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
        className="navbar-end"
        style={{
          display: "flex",
          columnGap: "1rem",
          rowGap: "0.1rem",
          flexWrap: "wrap",
          color: "#ccc",
          userSelect: "none",
        }}
        onFocus={() => setFocused(() => true)}
        onBlur={() => setFocused(() => false)}
      >
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span>Size</span>
          <input
            type="range"
            step="5"
            min="15"
            max="150"
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.currentTarget.value, 10))}
          />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span>Margin</span>
          <input
            type="range"
            step="1"
            min="0"
            max="35"
            value={margin}
            onChange={(e) => setMargin(parseInt(e.currentTarget.value, 10))}
          />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span>Contrast</span>
          <input
            type="range"
            step="10"
            min="10"
            max="100"
            value={opacity}
            onChange={(e) => setOpacity(parseInt(e.currentTarget.value, 10))}
          />
        </div>
      </div>
    </nav>
  );
}

function useActionHotkeys(action: { action: () => void; disabled: boolean; keys: string[] }) {
  return useHotkeys(action.keys, action.action, { enabled: !action.disabled }, [
    action.action,
    action.disabled,
  ]);
}

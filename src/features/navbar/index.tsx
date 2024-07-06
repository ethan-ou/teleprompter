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
      <div style={{ alignItems: "center", display: "flex", columnGap: "0.25rem" }}>
        <button
          className="button"
          disabled={status === "editing"}
          onClick={() => (status === "stopped" ? startTeleprompter() : stopTeleprompter())}
          title={status === "stopped" || status === "editing" ? "Start" : "Stop"}
        >
          <span className="icon">
            {status === "stopped" || status === "editing" ? (
              <Play style={{ color: "#0ea44d", fill: "#0ea44d" }} className="icon" />
            ) : (
              <Pause style={{ color: "#d03739", fill: "#d03739" }} className="icon" />
            )}
          </span>
        </button>
        <button
          className="button"
          onClick={() => (toggleEdit(), setTextElements(), resetTimer())}
          disabled={status === "started"}
          title="Edit"
        >
          <Pencil className={`icon ${status === "editing" ? "yellow" : ""}`} />
        </button>
        <button
          className="button"
          onClick={() => {
            if (confirm("Are you sure you want to clear your script?")) {
              setContent("");
              setTextElements();
            }
          }}
          disabled={status === "started"}
          title="Clear"
        >
          <Trash2 className="icon" />
        </button>
        <button
          className="button"
          disabled={status === "editing"}
          onClick={() => flipHorizontally()}
          title="Flip Text Horizontally"
        >
          <MoveHorizontal className={`icon ${horizontallyFlipped ? "yellow" : ""}`} />
        </button>
        <button
          className="button"
          disabled={status === "editing"}
          onClick={() => flipVertically()}
          title="Flip Text Vertically"
        >
          <MoveVertical className={`icon ${verticallyFlipped ? "yellow" : ""}`} />
        </button>
        <button
          className="button"
          onClick={() => (fullscreen.active ? fullscreen.exit() : fullscreen.enter())}
          title={fullscreen.active ? "Exit Fullscreen" : "Fullscreen"}
        >
          <Expand className={`icon ${fullscreen.active ? "yellow" : ""}`} />
        </button>
        <button
          className="button"
          disabled={status !== "stopped"}
          onClick={() => (resetTranscriptionIndices(), resetTimer())}
          title="Restart from the beginning"
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
      >
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span>Size</span>
          <input
            type="range"
            step="5"
            min="10"
            max="200"
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

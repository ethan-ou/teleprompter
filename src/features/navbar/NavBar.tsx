import { useAppDispatch, useAppSelector } from "../../app/hooks"

import { startTeleprompter, stopTeleprompter } from "../../app/thunks"

import {
  toggleEdit,
  flipHorizontally,
  flipVertically,
  setFontSize,
  setMargin,
  setOpacity,
  selectStatus,
  selectHorizontallyFlipped,
  selectVerticallyFlipped,
  selectFontSize,
  selectMargin,
  selectOpacity,
} from "./navbarSlice"

import { resetTranscriptionIndices } from "../content/contentSlice"

export const NavBar = () => {
  const dispatch = useAppDispatch()

  const status = useAppSelector(selectStatus)
  const fontSize = useAppSelector(selectFontSize)
  const margin = useAppSelector(selectMargin)
  const opacity = useAppSelector(selectOpacity)
  const horizontallyFlipped = useAppSelector(selectHorizontallyFlipped)
  const verticallyFlipped = useAppSelector(selectVerticallyFlipped)

  return (
    <nav
      className="navbar is-black has-text-light is-unselectable"
      role="navigation"
      aria-label="main navigation"
    >
      <div
        style={{
          display: "flex",
          gap: "1rem",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          padding: "0.5rem",
        }}
      >
        {status === "stopped" ? (
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "1rem" }}>
              <span>Size:</span>
              <input
                type="range"
                step="5"
                min="10"
                max="200"
                value={fontSize}
                onChange={e =>
                  dispatch(setFontSize(parseInt(e.currentTarget.value, 10)))
                }
              />
            </div>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <span>Margin:</span>
              <input
                type="range"
                step="10"
                min="0"
                max="500"
                value={margin}
                onChange={e =>
                  dispatch(setMargin(parseInt(e.currentTarget.value, 10)))
                }
              />
            </div>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <span>Brightness:</span>
              <input
                type="range"
                step="10"
                min="0"
                max="100"
                value={opacity}
                onChange={e =>
                  dispatch(setOpacity(parseInt(e.currentTarget.value, 10)))
                }
              />
            </div>
          </div>
        ) : null}

        <div style={{ alignItems: "center", display: "flex", gap: "0.25rem" }}>
          {status !== "started" ? (
            <>
              <button
                className={`button ${status === "editing" ? "editing" : ""}`}
                onClick={() => dispatch(toggleEdit())}
                title="Edit"
              >
                <span className="icon is-small">
                  <i className="fa-solid fa-pencil" />
                </span>
              </button>
              <button
                className={`button ${horizontallyFlipped ? "horizontally-flipped" : ""}`}
                disabled={status !== "stopped"}
                onClick={() => dispatch(flipHorizontally())}
                title="Flip Text Horizontally"
              >
                <span className="icon is-small">
                  <i className="fa-solid fa-left-right" />
                </span>
              </button>
              <button
                className={`button ${verticallyFlipped ? "vertically-flipped" : ""}`}
                disabled={status !== "stopped"}
                onClick={() => dispatch(flipVertically())}
                title="Flip Text Vertically"
              >
                <span className="icon is-small">
                  <i className="fa-solid fa-up-down" />
                </span>
              </button>
              <button
                className="button"
                disabled={status !== "stopped"}
                onClick={() => dispatch(resetTranscriptionIndices())}
                title="Restart from the beginning"
              >
                <span className="icon is-small">
                  <i className="fa-solid fa-arrows-rotate" />
                </span>
              </button>
            </>
          ) : null}

          <button
            className="button"
            disabled={status === "editing"}
            onClick={() =>
              dispatch(
                status === "stopped" ? startTeleprompter() : stopTeleprompter(),
              )
            }
            title={
              status === "stopped" || status === "editing" ? "Start" : "Stop"
            }
          >
            <span className="icon is-small">
              <i
                className={`fa-solid ${status === "stopped" || status === "editing" ? "fa-play" : "fa-stop"}`}
              />
            </span>
          </button>
        </div>
      </div>
    </nav>
  )
}

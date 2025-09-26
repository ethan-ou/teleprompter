import { useCallback, useRef, useMemo } from "react";
import { useNavbarStore } from "../navbar/store";
import { useContent } from "./store";
import { useHotkeys } from "react-hotkeys-hook";
import { getBoundsStart, resetTranscriptWindow } from "@/lib/speech-matcher";
import { useInterval } from "@/app/hooks";
import { getNextSentence, getPrevSentence } from "@/lib/word-tokenizer";
import { scroll } from "@/lib/smooth-scroll";
import { Text } from "@/components/Text";

export function Content() {
  const status = useNavbarStore((state) => state.status);
  const fontSize = useNavbarStore((state) => state.fontSize);
  const margin = useNavbarStore((state) => state.margin);
  const opacity = useNavbarStore((state) => state.opacity);
  const align = useNavbarStore((state) => state.align);
  const toggleEdit = useNavbarStore((state) => state.toggleEdit);

  const { text, setText, tokens, position, setPosition, setTokens } = useContent();

  const { search, end } = position;

  // Memoize the style object, dependencies are already correct.
  const style: React.CSSProperties = useMemo(
    () => ({
      fontSize: `${fontSize}px`,
      paddingLeft: `${margin}vw`,
      // Add more space to the right side for improved readability
      paddingRight: `${margin * 0.8 - Math.min(fontSize / 80, 1) * 0.4}vw`,
      opacity: opacity / 100,
      paddingTop: {
        top: "1rem",
        center: `calc(50vh - ${fontSize * 2}px)`,
        bottom: `calc(${(3 / 4) * 100}vh -  ${fontSize * 2}px)`,
      }[align],
    }),
    [fontSize, margin, opacity, align],
  );

  const lastRef = useRef<null | HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // The interval callback is wrapped in useCallback to ensure its reference
  // is stable for the useEffectInterval dependency check.
  const scrollCallback = useCallback(async () => {
    isScrollingRef.current = true;

    try {
      if (lastRef.current && end > 0) {
        await scroll({
          top: {
            top: lastRef.current.offsetTop,
            center:
              lastRef.current.offsetTop -
              document.documentElement.clientHeight / 2 +
              fontSize * 2,
            bottom:
              lastRef.current.offsetTop -
              (3 / 4) * document.documentElement.clientHeight +
              fontSize * 2,
          }[align],
          behavior: "smooth",
        });
      } else {
        await scroll({
          top: 0,
          behavior: "smooth",
        });
      }
    } finally {
      isScrollingRef.current = false;
    }
  }, [end, fontSize, align]); // Dependencies on state values used within the async function

  useInterval(
    () => {
      if (status !== "editing" && !isScrollingRef.current) {
        scrollCallback();
      }
    },
    status === "started" ? 2000 : null,
  );

  const mainRef = useRef<HTMLElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // Hotkey callbacks are wrapped in useCallback where necessary, and dependencies are cleaned.
  // ctrl+a is fine as is, dependencies are empty.
  useHotkeys(
    "ctrl+a",
    () => {
      if (textAreaRef.current) {
        textAreaRef.current.focus();
        textAreaRef.current.select();
      } else if (mainRef.current) {
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(mainRef.current);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    },
    { preventDefault: true },
    [],
  );

  // Hotkey for ESC: dependencies are already correct.
  useHotkeys(
    "esc",
    () => (toggleEdit(), setTokens()),
    {
      enableOnFormTags: ["textarea"],
      enabled: status === "editing",
    },
    [toggleEdit, setTokens],
  );

  // Hotkey for moving backward: dependencies cleaned.
  // Utility functions (getPrevSentence, getBoundsStart) are stable and removed from deps.
  const handleMoveBackward = useCallback(() => {
    const token = getPrevSentence(tokens, search);
    if (token) {
      const selectedPosition = token.index - 1;
      const boundStart = getBoundsStart(tokens, selectedPosition);
      setPosition({
        start: selectedPosition,
        end: selectedPosition,
        search: selectedPosition,
        ...(boundStart !== undefined && { bounds: boundStart }),
      });
      resetTranscriptWindow();
    }
  }, [tokens, search, setPosition]); // Only include state and setters

  useHotkeys(
    ["ArrowLeft", "ArrowUp", "PageUp"],
    handleMoveBackward,
    { enabled: status !== "editing" },
    [handleMoveBackward, status],
  );

  // Hotkey for moving forward: dependencies cleaned.
  // Utility functions (getNextSentence, getBoundsStart) are stable and removed from deps.
  const handleMoveForward = useCallback(() => {
    const token = getNextSentence(tokens, search);
    if (token) {
      const selectedPosition = token.index - 1;
      const boundStart = getBoundsStart(tokens, selectedPosition);
      setPosition({
        start: selectedPosition,
        end: selectedPosition,
        search: selectedPosition,
        ...(boundStart !== undefined && { bounds: boundStart }),
      });
      resetTranscriptWindow();
    }
  }, [tokens, search, setPosition]); // Only include state and setters

  useHotkeys(
    ["ArrowRight", "ArrowDown", "PageDown"],
    handleMoveForward,
    { enabled: status !== "editing" },
    [handleMoveForward, status],
  );

  return (
    <main ref={mainRef}>
      {status === "editing" ? (
        <div className="grid grid-cols-1 grid-rows-1">
          {/* Use an invisible div to force an increase in textarea sizing.
              This should have exactly the same size and properties as the textarea. */}
          <div className="content invisible col-start-1 row-start-1" style={style}>
            {text}
          </div>
          <textarea
            ref={textAreaRef}
            className="content col-start-1 row-start-1"
            style={{ ...style, cursor: "text", overflow: "hidden" }}
            value={text}
            onChange={(e) => setText(e.target.value || "")}
            placeholder="Enter your content here..."
          />
        </div>
      ) : (
        <Text style={style} lastRef={lastRef} />
      )}
    </main>
  );
}

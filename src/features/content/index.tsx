import { useRef, useMemo } from "react";
import { useNavbarStore } from "../navbar/store";
import { useContent } from "./store";
import { useHotkeys } from "react-hotkeys-hook";
import { getBoundsStart, resetTranscriptWindow } from "@/lib/speech-matcher";
import { useLayoutEffectInterval } from "@/app/hooks";
import { getNextSentence, getPrevSentence } from "@/lib/word-tokenizer";
import { scroll } from "@/lib/smooth-scroll";
import { Text } from "@/components/Text";

export function Content() {
  const { status, fontSize, margin, opacity, align, toggleEdit } = useNavbarStore((state) => state);
  const { text, setText, tokens, position, setPosition, setTokens } = useContent();

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
        bottom: `calc(${(3 / 4) * 100}vh -  ${fontSize * 2}px)`,
      }[align],
    }),
    [fontSize, margin, opacity, align],
  );

  const lastRef = useRef<null | HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  useLayoutEffectInterval(
    () => {
      const performScroll = async () => {
        isScrollingRef.current = true;

        try {
          if (lastRef.current && position.end > 0) {
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
      };

      if (status !== "editing" && !isScrollingRef.current) {
        performScroll();
      }
    },
    status === "started" ? 2000 : null,
  );

  // Overwrite ctrl+a to allow text selection without also selecting inputs.
  const mainRef = useRef<HTMLElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
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

  useHotkeys(
    "esc",
    () => (toggleEdit(), setTokens()),
    {
      enableOnFormTags: ["textarea"],
      enabled: status === "editing",
    },
    [toggleEdit, setTokens],
  );

  useHotkeys(
    ["ArrowLeft", "ArrowUp", "PageUp"],
    () => {
      const token = getPrevSentence(tokens, position.search);
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
    },
    { enabled: status !== "editing" },
    [tokens, position.search, getPrevSentence, getBoundsStart, setPosition],
  );

  useHotkeys(
    ["ArrowRight", "ArrowDown", "PageDown"],
    () => {
      const token = getNextSentence(tokens, position.search);
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
    },
    { enabled: status !== "editing" },
    [tokens, position.search, getPrevSentence, getBoundsStart, setPosition],
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

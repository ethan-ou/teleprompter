import { useRef } from "react";
import { escape } from "@/lib/html-escaper";
import { useNavbarStore } from "../navbar/store";
import { useContentStore } from "./store";
import { useHotkeys } from "react-hotkeys-hook";
import { getBoundsStart, resetTranscriptWindow } from "@/lib/speech-matcher";
import { useEffectInterval } from "@/app/hooks";
import { clsx } from "@/lib/css";
import { getNextSentence, getNextWordIndex, getPrevSentence } from "@/lib/word-tokenizer";

export function Content() {
  const { status, mirror, fontSize, margin, opacity, align, toggleEdit } = useNavbarStore(
    (state) => state,
  );
  const { text, setText, tokens, position, setPosition, setTokens } = useContentStore(
    (state) => state,
  );

  const style: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    paddingLeft: `${margin}vw`,
    paddingRight: `${margin * 1 - Math.min(fontSize / 80, 1) * 0.25}vw`,
    opacity: opacity / 100,
    paddingTop: {
      top: "1rem",
      center: `calc(50vh - ${fontSize * 2}px)`,
      bottom: `calc(${(3 / 4) * 100}vh -  ${fontSize * 2}px)`,
    }[align],
  };

  const lastRef = useRef<null | HTMLDivElement>(null);

  useEffectInterval(
    () => {
      if (status !== "editing") {
        if (lastRef.current && position.end > 0) {
          window.scrollTo({
            top: {
              top: lastRef.current.offsetTop - fontSize,
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
          window.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        }
      }
    },
    status === "started" ? 750 : null,
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
        <div
          className={clsx("content select-none", status === "started" ? "content-transition" : "")}
          style={{
            ...style,
            transform: `scaleX(${mirror ? "-1" : "1"})`,
          }}
        >
          {tokens.map((token, index) => (
            <span
              // Position ref a little after the end index to scroll past line breaks and punctuation.
              {...(index === Math.min(getNextWordIndex(tokens, position.end), tokens.length - 1)
                ? { ref: lastRef }
                : {})}
              key={token.index}
              onClick={() => {
                const selectedPosition = index - 1;
                const bounds = getBoundsStart(tokens, selectedPosition);
                setPosition({
                  start: selectedPosition,
                  search: selectedPosition,
                  end: selectedPosition,
                  ...(bounds !== undefined && {
                    bounds: Math.min(bounds, tokens.length),
                  }),
                });
              }}
              className={
                token.index <= position.start
                  ? "final-transcript"
                  : token.index <= position.end
                    ? "interim-transcript"
                    : status === "started" && token.index > position.bounds + 20
                      ? "opacity-40"
                      : status === "started" && token.index > position.bounds + 10
                        ? "opacity-60"
                        : status === "started" && token.index > position.bounds
                          ? "opacity-80"
                          : ""
              }
              dangerouslySetInnerHTML={{
                __html: escape(token.value).replace(/\n/g, "<br>"),
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}

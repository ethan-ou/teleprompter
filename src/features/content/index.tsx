import { useEffect, useRef } from "react";
import { escape } from "@/lib/html-escaper";
import { useNavbarStore } from "../navbar/store";
import { useContentStore } from "./store";
import { useHotkeys } from "react-hotkeys-hook";
import { getBoundsStart } from "@/lib/speech-matcher";

export function Content() {
  const { status, mirror, fontSize, margin, opacity, align } = useNavbarStore((state) => state);
  const { rawText, setContent, tokens, position, setPosition } = useContentStore((state) => state);

  const style: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    paddingLeft: `${margin}vw`,
    paddingRight: `${margin * 0.66}vw`,
    opacity: opacity / 100,
    paddingTop: align === "center" ? `calc(50vh - ${fontSize * 2}px)` : "0.5rem",
  };

  const lastRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "editing") {
      if (lastRef.current && position.end > 0) {
        const alignTop = lastRef.current.offsetTop - fontSize;
        const alignCenter =
          lastRef.current.offsetTop - document.documentElement.clientHeight / 2 + fontSize * 2;

        window.scrollTo({
          top: align === "center" ? alignCenter : alignTop,
          behavior: "smooth",
        });
      } else {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    }
  });

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
  );

  return (
    <main ref={mainRef}>
      {status === "editing" ? (
        <div className="grid">
          {/* Use an invisible div to force an increase in textarea sizing.
              This should have exactly the same size and properties as the textarea. */}
          <div className="content invisible col-start-1 row-start-1" style={style}>
            {rawText}
          </div>
          <textarea
            ref={textAreaRef}
            className="content col-start-1 row-start-1"
            style={{ ...style, cursor: "text", overflow: "hidden" }}
            value={rawText}
            onChange={(e) => setContent(e.target.value || "")}
            placeholder="Enter your content here..."
          />
        </div>
      ) : (
        <div
          className="content content-transition"
          style={{
            ...style,
            transform: `scaleX(${mirror ? "-1" : "1"})`,
          }}
        >
          {tokens.map((token, index) => (
            <span
              // Position ref a little after the end index to scroll past line breaks and punctuation.
              {...(index === Math.min(position.end + 2, tokens.length - 1) ? { ref: lastRef } : {})}
              key={token.index}
              onClick={() => {
                const selectedPosition = index - 1;
                const bounds = getBoundsStart(tokens, selectedPosition);
                setPosition({
                  start: selectedPosition,
                  search: selectedPosition,
                  end: selectedPosition,
                  ...(bounds !== undefined && { bounds: Math.min(bounds, tokens.length) }),
                });
              }}
              className={
                token.index <= position.start
                  ? "final-transcript"
                  : token.index <= position.end
                    ? "interim-transcript"
                    : status === "started" && token.index > position.bounds + 20
                      ? "opacity-40"
                      : status === "started" && token.index > position.bounds
                        ? "opacity-60"
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

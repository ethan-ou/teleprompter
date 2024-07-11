import { useEffect, useRef } from "react";
import { escape } from "@/lib/html-escaper";
import { useNavbarStore } from "../navbar/store";
import { useContentStore } from "./store";
import { useShallow } from "zustand/react/shallow";
import { useHotkeys } from "react-hotkeys-hook";

export function Content() {
  const { fontSize, margin, status, opacity, horizontallyFlipped, verticallyFlipped, align } =
    useNavbarStore(
      useShallow((state) => ({
        fontSize: state.fontSize,
        margin: state.margin,
        status: state.status,
        opacity: state.opacity,
        horizontallyFlipped: state.horizontallyFlipped,
        verticallyFlipped: state.verticallyFlipped,
        align: state.align,
      })),
    );

  const { rawText, setContent, textElements, start, setStart, end, setEnd, setSearch } =
    useContentStore((state) => state);

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
      if (lastRef.current && end > 0) {
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
          className="content"
          style={{
            ...style,
            transform: `scale(${horizontallyFlipped ? "-1" : "1"}, ${verticallyFlipped ? "-1" : "1"})`,
          }}
        >
          {textElements.map((textElement, index, array) => {
            const itemProps =
              end > 0 && index === Math.min(end + 2, array.length - 1) ? { ref: lastRef } : {};
            return (
              <span
                key={textElement.index}
                onClick={() => {
                  setStart(index - 1);
                  setSearch(index - 1);
                  setEnd(index - 1);
                }}
                className={
                  start > 0 && textElement.index <= start + 1
                    ? "final-transcript"
                    : end > 0 && textElement.index <= end + 1
                      ? "interim-transcript"
                      : ""
                }
                {...itemProps}
                dangerouslySetInnerHTML={{
                  __html: escape(textElement.value).replace(/\n/g, "<br>"),
                }}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}

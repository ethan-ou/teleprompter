import { useEffect, useRef } from "react";
import { escape } from "@/lib/html-escaper";
import { useNavbarStore } from "../navbar/store";
import { useContentStore } from "./store";
import { useShallow } from "zustand/react/shallow";

export function Content() {
  const {
    fontSize,
    margin,
    status,
    opacity,
    horizontallyFlipped,
    verticallyFlipped,
    align,
  } = useNavbarStore(
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

  const {
    rawText,
    setContent,
    textElements,
    interimTranscriptIndex,
    setInterimTranscriptIndex,
    finalTranscriptIndex,
    setFinalTranscriptIndex,
  } = useContentStore((state) => state);

  const style: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    paddingLeft: `${margin}vw`,
    paddingRight: `${margin * 0.66}vw`,
    opacity: opacity / 100,
    paddingTop:
      align === "center" ? `calc(50vh - ${fontSize * 2}px)` : "0.5rem",
  };

  const containerRef = useRef<null | HTMLDivElement>(null);
  const textAreaRef = useRef<null | HTMLDivElement>(null);
  const lastRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    if (status === "started") {
      if (lastRef.current && interimTranscriptIndex > 0) {
        const alignTop = lastRef.current.offsetTop - fontSize;
        const alignCenter =
          lastRef.current.offsetTop -
          document.documentElement.clientHeight / 2 +
          fontSize * 2;

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

  return (
    <>
      {status === "editing" ? (
        <div ref={textAreaRef} className="grid">
          {/* Use an invisible div to force an increase in textarea sizing.
              This should have exactly the same size and properties as the textarea. */}
          <div
            className="content invisible col-start-1 row-start-1"
            style={style}
          >
            {rawText}
          </div>
          <textarea
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
          ref={containerRef}
          style={{
            ...style,
            transform: `scale(${horizontallyFlipped ? "-1" : "1"}, ${verticallyFlipped ? "-1" : "1"})`,
          }}
        >
          {textElements.map((textElement, index, array) => {
            const itemProps =
              interimTranscriptIndex > 0 &&
              index === Math.min(interimTranscriptIndex + 2, array.length - 1)
                ? { ref: lastRef }
                : {};
            return (
              <span
                key={textElement.index}
                onClick={() => {
                  setFinalTranscriptIndex(index - 1);
                  setInterimTranscriptIndex(index - 1);
                }}
                className={
                  finalTranscriptIndex > 0 &&
                  textElement.index <= finalTranscriptIndex + 1
                    ? "final-transcript"
                    : interimTranscriptIndex > 0 &&
                        textElement.index <= interimTranscriptIndex + 1
                      ? "interim-transcript"
                      : "has-text-white"
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
    </>
  );
}

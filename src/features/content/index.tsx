import { useEffect, useRef } from "react";
import { escape } from "@/lib/html-escaper";
import { useNavbarStore } from "../navbar/store";
import { useContentStore } from "./store";
import { useShallow } from "zustand/react/shallow";

export function Content() {
  const { fontSize, margin, status, opacity, horizontallyFlipped, verticallyFlipped } =
    useNavbarStore(
      useShallow((state) => ({
        fontSize: state.fontSize,
        margin: state.margin,
        status: state.status,
        opacity: state.opacity,
        horizontallyFlipped: state.horizontallyFlipped,
        verticallyFlipped: state.verticallyFlipped,
      }))
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
  };

  const containerRef = useRef<null | HTMLDivElement>(null);
  const lastRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      if (lastRef.current && interimTranscriptIndex > 0) {
        containerRef.current.scrollTo({
          top: lastRef.current.offsetTop - 100,
          behavior: "smooth",
        });
      } else {
        containerRef.current.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    }
  });

  return (
    <main
      style={{
        height: status === "editing" ? "100%" : "inherit",
        overflowY: status === "editing" ? "inherit" : "auto",
      }}
    >
      {status === "editing" ? (
        <textarea
          className="content"
          style={{ ...style, cursor: "text" }}
          value={rawText}
          onChange={(e) => setContent(e.target.value || "")}
          placeholder="Enter your content here..."
        />
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
                  finalTranscriptIndex > 0 && textElement.index <= finalTranscriptIndex + 1
                    ? "final-transcript"
                    : interimTranscriptIndex > 0 && textElement.index <= interimTranscriptIndex + 1
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
    </main>
  );
}

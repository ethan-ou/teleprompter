import { useEffect, useRef } from "react";
import { escape } from "@/lib/html-escaper";
import { useNavbarStore } from "../navbar/store";
import { useContentStore } from "./store";
import { useShallow } from "zustand/react/shallow";
import { useLayoutEffect } from "preact/hooks";

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

  const mainRef = useRef<HTMLElement>(null);
  const scrollPosition = useRef(0);

  const style: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    paddingLeft: `${margin}vw`,
    paddingRight: `${margin * 0.66}vw`,
    opacity: opacity / 100,
    paddingTop:
      align === "center" ? `calc(50vh - ${fontSize * 2}px)` : "0.5rem",
  };

  const containerRef = useRef<null | HTMLDivElement>(null);
  const textAreaRef = useRef<null | HTMLTextAreaElement>(null);
  const lastRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      if (lastRef.current && interimTranscriptIndex > 0) {
        const alignTop = lastRef.current.offsetTop - fontSize;
        const alignCenter =
          lastRef.current.offsetTop -
          containerRef.current.clientHeight / 2 +
          fontSize * 2;

        containerRef.current.scrollTo({
          top: align === "center" ? alignCenter : alignTop,
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

  useLayoutEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.scrollTo({
        top: scrollPosition.current,
      });
    }
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: scrollPosition.current,
      });
    }
  }, [status]);

  return (
    <main
      ref={mainRef}
      className={`grow`}
      style={{
        height: status === "editing" ? "100%" : "inherit",
        overflowY: status === "editing" ? "initial" : "inherit",
      }}
    >
      {status === "editing" ? (
        <textarea
          ref={textAreaRef}
          className="content"
          style={{ ...style, cursor: "text" }}
          value={rawText}
          onChange={(e) => setContent(e.target.value || "")}
          placeholder="Enter your content here..."
          onScroll={(e) => {
            scrollPosition.current = e.currentTarget.scrollTop;
          }}
        />
      ) : (
        <div
          className="content"
          ref={containerRef}
          style={{
            ...style,
            transform: `scale(${horizontallyFlipped ? "-1" : "1"}, ${verticallyFlipped ? "-1" : "1"})`,
          }}
          onScroll={(e) => {
            scrollPosition.current = e.currentTarget.scrollTop;
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
    </main>
  );
}

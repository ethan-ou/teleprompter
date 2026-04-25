import { useInterval } from "@/app/hooks";
import { useContentStore } from "@/features/content/store";
import { useTrackerStore } from "@/features/tracker/store";
import { useNavbarStore } from "@/features/navbar/store";
import { clsx } from "@/lib/css";
import { scroll } from "@/lib/smooth-scroll";
import { getNextSentence, getNextWordIndex, getPrevSentence, type Token as TokenType } from "@/lib/word-tokenizer";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

export function Content() {
  const status = useNavbarStore((state) => state.status);
  const fontSize = useNavbarStore((state) => state.fontSize);
  const margin = useNavbarStore((state) => state.margin);
  const opacity = useNavbarStore((state) => state.opacity);
  const align = useNavbarStore((state) => state.align);
  const toggleEdit = useNavbarStore((state) => state.toggleEdit);

  const { text, setText, tokens, setTokens } = useContentStore();
  const displayIndex = useTrackerStore((s) => s.currentPosition);

  const style: React.CSSProperties = useMemo(
    () => ({
      fontSize: `${fontSize}px`,
      paddingLeft: `${margin}vw`,
      paddingRight: `${margin * 0.8 - Math.min(fontSize / 80, 1) * 0.4}vw`,
      opacity: opacity / 100,
      paddingTop: {
        top: "1rem",
        center: `calc(50vh - ${fontSize * 2}px)`,
        bottom: `calc(${(3 / 4) * 100}vh - ${fontSize * 2}px)`,
      }[align],
    }),
    [fontSize, margin, opacity, align],
  );

  const lastRef = useRef<HTMLSpanElement>(null);
  const isScrollingRef = useRef(false);

  const scrollCallback = useCallback(async () => {
    isScrollingRef.current = true;

    try {
      if (lastRef.current && displayIndex > 0) {
        await scroll({
          top: {
            top: lastRef.current.offsetTop,
            center:
              lastRef.current.offsetTop - document.documentElement.clientHeight / 2 + fontSize * 2,
            bottom:
              lastRef.current.offsetTop -
              (3 / 4) * document.documentElement.clientHeight +
              fontSize * 2,
          }[align],
          behavior: "smooth",
        });
      } else {
        await scroll({ top: 0, behavior: "smooth" });
      }
    } finally {
      isScrollingRef.current = false;
    }
  }, [displayIndex, fontSize, align]);

  useInterval(
    () => {
      if (status !== "editing" && !isScrollingRef.current) {
        scrollCallback();
      }
    },
    status === "started" ? 2000 : null,
  );

  useEffect(() => {
    if (status === "stopped") {
      scrollCallback();
    }
  }, [fontSize, margin, status]);

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
    { enableOnFormTags: ["textarea"], enabled: status === "editing" },
    [toggleEdit, setTokens],
  );

  const confirmedIndex = useContentStore((s) => s.position.confirmedIndex);

  const handleMoveBack = useCallback(() => {
    const token = getPrevSentence(tokens, confirmedIndex);
    if (token) {
      useTrackerStore.getState().seek(token.index - 1);
    }
  }, [tokens, confirmedIndex]);

  useHotkeys(
    ["ArrowLeft", "ArrowUp", "PageUp"],
    handleMoveBack,
    { enabled: status !== "editing" },
    [handleMoveBack, status],
  );

  const handleMoveForward = useCallback(() => {
    const token = getNextSentence(tokens, confirmedIndex);
    if (token) {
      useTrackerStore.getState().seek(token.index - 1);
    }
  }, [tokens, confirmedIndex]);

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
        <Text style={style} lastRef={lastRef} displayIndex={displayIndex} />
      )}
    </main>
  );
}

// Fade-ahead zones in full-sequence token index units.
// Full-sequence indices include delimiters, so ~2 indices per word.
// These values approximate the old bounds-based fade (which started ~50 tokens ahead).
const FADE_NEAR = 50;
const FADE_MID = 60;
const FADE_FAR = 70;

const getTokenClassname = (
  token: TokenType,
  confirmedIndex: number,
  displayIndex: number,
  status: string,
) => {
  if (token.value.trim() === "") return "";
  if (token.index <= confirmedIndex) return "final-transcript";
  if (token.index <= displayIndex) return "interim-transcript";
  if (status === "started") {
    if (token.index > displayIndex + FADE_FAR) return "opacity-40";
    if (token.index > displayIndex + FADE_MID) return "opacity-60";
    if (token.index > displayIndex + FADE_NEAR) return "opacity-80";
  }
  return "";
};

export function Text({
  style,
  lastRef,
  displayIndex,
}: {
  style: React.CSSProperties;
  lastRef: React.RefObject<HTMLSpanElement | null>;
  displayIndex: number;
}) {
  const status = useNavbarStore((state) => state.status);
  const mirror = useNavbarStore((state) => state.mirror);
  const { tokens } = useContentStore();
  const confirmedIndex = useContentStore((s) => s.position.confirmedIndex);

  const memoizedTokens = useMemo(() => {
    return tokens.map((token, index) => {
      const isLastRef =
        index === Math.min(getNextWordIndex(tokens, displayIndex), tokens.length - 1);
      const ref = isLastRef ? lastRef : undefined;

      const handleClick = () => {
        useTrackerStore.getState().seek(token.index - 1);
      };

      return (
        <Token
          key={token.index}
          token={token}
          className={getTokenClassname(token, confirmedIndex, displayIndex, status)}
          ref={ref}
          onClick={handleClick}
        />
      );
    });
  }, [tokens, confirmedIndex, displayIndex, status, lastRef]);

  return (
    <div
      className={clsx("content select-none", status === "started" ? "content-transition" : "")}
      style={{ ...style, transform: `scaleX(${mirror ? "-1" : "1"})` }}
    >
      {memoizedTokens}
    </div>
  );
}

export const Token = memo<{
  token: TokenType;
  className: string;
  ref?: React.Ref<HTMLSpanElement>;
  onClick: () => void;
}>(
  ({ token, className, ref, onClick }) => {
    return (
      <span ref={ref} key={token.index} onClick={onClick} className={className}>
        {token.value}
      </span>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.token.index === nextProps.token.index &&
      prevProps.token.value === nextProps.token.value &&
      prevProps.className === nextProps.className
    );
  },
);

Token.displayName = "Token";

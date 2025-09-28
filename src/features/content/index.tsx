import { useInterval } from "@/app/hooks";
import { type Position, useContent } from "@/features/content/store";
import { useNavbarStore } from "@/features/navbar/store";
import { clsx } from "@/lib/css";
import { scroll } from "@/lib/smooth-scroll";
import { getBoundsStart, resetTranscriptWindow } from "@/lib/speech-matcher";
import {
  getNextSentence,
  getNextWordIndex,
  getPrevSentence,
  type Token as TokenType,
} from "@/lib/word-tokenizer";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useCollaborateStore } from "../collaborate/store";

export function Content() {
  const status = useNavbarStore((state) => state.status);
  const fontSize = useNavbarStore((state) => state.fontSize);
  const margin = useNavbarStore((state) => state.margin);
  const opacity = useNavbarStore((state) => state.opacity);
  const align = useNavbarStore((state) => state.align);
  const toggleEdit = useNavbarStore((state) => state.toggleEdit);
  const isConnected = useCollaborateStore((state) => state.isConnected);

  const { text, setText, tokens, position, setPosition, setTokens } = useContent();

  const { search, end } = position;

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
      if (lastRef.current && end > 0) {
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
        await scroll({
          top: 0,
          behavior: "smooth",
        });
      }
    } finally {
      isScrollingRef.current = false;
    }
  }, [end, fontSize, align]);

  useInterval(
    () => {
      if (status !== "editing" && !isScrollingRef.current) {
        scrollCallback();
      }
    },
    status === "started" || isConnected() ? 2000 : null,
  );

  // Retrigger scroll in case font size and margin changes while stopped
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
    {
      enableOnFormTags: ["textarea"],
      enabled: status === "editing",
    },
    [toggleEdit, setTokens],
  );

  const handleMoveBack = useCallback(() => {
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
  }, [tokens, search, setPosition]);

  useHotkeys(
    ["ArrowLeft", "ArrowUp", "PageUp"],
    handleMoveBack,
    { enabled: status !== "editing" },
    [handleMoveBack, status],
  );

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
  }, [tokens, search, setPosition]);

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

const getTokenClassname = (token: TokenType, position: Position, status: string) => {
  if (token.value.trim() === "") {
    return "";
  }

  if (token.index <= position.start) {
    return "final-transcript";
  } else if (token.index <= position.end) {
    return "interim-transcript";
  } else if (status === "started") {
    if (token.index > position.bounds + 20) {
      return "opacity-40";
    } else if (token.index > position.bounds + 10) {
      return "opacity-60";
    } else if (token.index > position.bounds) {
      return "opacity-80";
    }
  }

  return "";
};

export function Text({
  style,
  lastRef,
}: {
  style: React.CSSProperties;
  lastRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const status = useNavbarStore((state) => state.status);
  const mirror = useNavbarStore((state) => state.mirror);
  const { tokens, position, setPosition } = useContent();

  const memoizedTokens = useMemo(() => {
    return tokens.map((token, index) => {
      const isLastRef =
        index === Math.min(getNextWordIndex(tokens, position.end), tokens.length - 1);
      const ref = isLastRef ? lastRef : undefined;

      const handleClick = () => {
        const selectedPosition = index - 1;
        const newBounds = getBoundsStart(tokens, selectedPosition);
        setPosition({
          start: selectedPosition,
          search: selectedPosition,
          end: selectedPosition,
          ...(newBounds !== undefined && {
            bounds: Math.min(newBounds, tokens.length),
          }),
        });
      };

      return (
        <Token
          key={token.index}
          token={token}
          className={getTokenClassname(token, position, status)}
          ref={ref}
          onClick={handleClick}
        />
      );
    });
  }, [tokens, position.start, position.end, position.bounds, status, lastRef, setPosition]);

  return (
    <div
      className={clsx("content select-none", status === "started" ? "content-transition" : "")}
      style={{
        ...style,
        transform: `scaleX(${mirror ? "-1" : "1"})`,
      }}
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

import { useContent } from "@/features/content/store";
import { useNavbarStore } from "@/features/navbar/store";
import { clsx } from "@/lib/css";
import { escape } from "@/lib/html-escaper";
import { getBoundsStart } from "@/lib/speech-matcher";
import { getNextWordIndex, type Token as TokenType } from "@/lib/word-tokenizer";
import { memo, useMemo } from "react";

interface TextProps {
  style: React.CSSProperties;
  lastRef: React.RefObject<HTMLDivElement | null>;
}

export function Text({ style, lastRef }: TextProps) {
  const status = useNavbarStore(state => state.status);
  const { tokens, position, setPosition } = useContent();
  const { start, end, bounds } = position;

  // Memoize all tokens to prevent unnecessary re-renders in the map function
  const memoizedTokens = useMemo(() => {
    return tokens.map((token, index) => {
      let className = "";
      if (token.index <= start) {
        className = "final-transcript";
      } else if (token.index <= end) {
        className = "interim-transcript";
      } else if (status === "started") {
        if (token.index > bounds + 20) {
          className = "opacity-40";
        } else if (token.index > bounds + 10) {
          className = "opacity-60";
        } else if (token.index > bounds) {
          className = "opacity-80";
        }
      }

      const isLastRef = index === Math.min(getNextWordIndex(tokens, end), tokens.length - 1);
      const ref = isLastRef ? (lastRef as React.RefObject<HTMLSpanElement>) : undefined;

      // Memoize click handler here
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
          className={className}
          ref={ref}
          onClick={handleClick}
        />
      );
    });
  }, [tokens, start, end, bounds, status, lastRef, setPosition]);

  return (
    <div
      className={clsx("content select-none", status === "started" ? "content-transition" : "")}
      style={{
        ...style,
        transform: `scaleX(${useNavbarStore.getState().mirror ? "-1" : "1"})`,
      }}
    >
      {memoizedTokens}
    </div>
  );
}

interface TokenProps {
  token: TokenType;
  className: string;
  ref?: React.Ref<HTMLSpanElement>;
  onClick: () => void;
}

export const Token = memo<TokenProps>(
  ({ token, className, ref, onClick }) => {
    // Memoize the HTML content
    const htmlContent = useMemo(
      () => ({
        __html: escape(token.value).replace(/\n/g, "<br>"),
      }),
      [token.value],
    );

    return (
      <span
        ref={ref}
        key={token.index}
        onClick={onClick}
        className={className}
        dangerouslySetInnerHTML={htmlContent}
      />
    );
  },
  // Custom comparison to ensure memo works
  (prevProps, nextProps) => {
    return (
      prevProps.token.index === nextProps.token.index &&
      prevProps.token.value === nextProps.token.value &&
      prevProps.className === nextProps.className
    );
  },
);

Token.displayName = "Token";
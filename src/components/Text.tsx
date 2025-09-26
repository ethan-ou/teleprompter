import { useContent } from "@/features/content/store";
import { useNavbarStore } from "@/features/navbar/store";
import { cn } from "@/lib/css";
import { escape } from "@/lib/html-escaper";
import { getBoundsStart } from "@/lib/speech-matcher";
import { getNextWordIndex, type Token as TokenType } from "@/lib/word-tokenizer";
import { memo, useCallback, useMemo } from "react";

interface TextProps {
  style: React.CSSProperties;
  lastRef: React.RefObject<HTMLDivElement | null>;
}

export function Text({ style, lastRef }: TextProps) {
  const { status, mirror } = useNavbarStore();

  // For collaborative sessions, we need to use the useContent hook
  // which handles room content properly
  const { tokens, position } = useContent();

  return (
    <div
      className={cn("content select-none", status === "started" ? "content-transition" : "")}
      style={{
        ...style,
        transform: `scaleX(${mirror ? "-1" : "1"})`,
      }}
    >
      {tokens.map((token, index) => {
        const isLastRef =
          index === Math.min(getNextWordIndex(tokens, position.end), tokens.length - 1);

        return (
          <Token
            key={token.index}
            token={token}
            index={index}
            tokens={tokens}
            ref={isLastRef ? (lastRef as React.RefObject<HTMLSpanElement>) : undefined}
          />
        );
      })}
    </div>
  );
}

interface TokenProps {
  token: TokenType;
  index: number;
  tokens: TokenType[];
  ref?: React.Ref<HTMLSpanElement>;
}

export const Token = memo<TokenProps>(
  ({ token, index, tokens, ref }) => {
    const { position, setPosition } = useContent();
    const { status } = useNavbarStore();

    // Memoize click handler to prevent unnecessary re-renders
    const handleClick = useCallback(() => {
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
    }, [index, tokens, setPosition]);

    // Memoize className calculation
    const className = useMemo(() => {
      if (token.index <= position.start) {
        return "final-transcript";
      }
      if (token.index <= position.end) {
        return "interim-transcript";
      }
      if (status === "started") {
        if (token.index > position.bounds + 20) {
          return "opacity-40";
        }
        if (token.index > position.bounds + 10) {
          return "opacity-60";
        }
        if (token.index > position.bounds) {
          return "opacity-80";
        }
      }
      return "";
    }, [token.index, position.start, position.end, position.bounds, status]);

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
        onClick={handleClick}
        className={className}
        dangerouslySetInnerHTML={htmlContent}
      />
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for memo
    // Only re-render if the token content, index, or relevant position/status changes
    return (
      prevProps.token.index === nextProps.token.index &&
      prevProps.token.value === nextProps.token.value &&
      prevProps.index === nextProps.index &&
      // Compare tokens array reference (since it's memoized from zustand)
      prevProps.tokens === nextProps.tokens
    );
  },
);

Token.displayName = "Token";

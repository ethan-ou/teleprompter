import { type TextElement, tokenize } from "./word-tokenizer";
import { matchText } from "./ngram-matcher";

export function createTranscriptTokens(text: string) {
  return tokenize(text).filter((element) => element.type === "TOKEN");
}

export function createTextSearchRegion(
  tokens: TextElement[],
  index: number,
  quantity = 20,
  backtrack = 5,
) {
  return tokens
    .slice(index - backtrack > 0 ? index - backtrack : 0, index + quantity)
    .filter((element) => element.type === "TOKEN");
}

class TranscriptSession {
  previousTokens: TextElement[] = [];
  recentTokens: TextElement[] = [];
  currentTokenQuantity = 0;
  previousTokenQuantity = 0;
  lastMatch: TextElement[] = [];

  public getSection(): TextElement[] {
    if (this.lastMatch.length === 0) {
      const recentMatch = this.findRecentMatch(
        this.lastMatch,
        this.recentTokens,
      );
      if (recentMatch > -1 && this.recentTokens.length - recentMatch <= 5) {
        return this.recentTokens.slice(
          recentMatch + 1,
          this.recentTokens.length,
        );
      }
    }
    return this.recentTokens.slice(-5);
  }

  private findRecentMatch(
    lastMatch: TextElement[],
    recentTokens: TextElement[],
  ) {
    if (lastMatch.length > 0) {
      for (let i = lastMatch.length - 1; i >= 0; i--) {
        const index = recentTokens.findIndex(
          (token) =>
            lastMatch[i].index === token.index &&
            lastMatch[i].value === token.value,
        );
        if (index > -1) return index;
      }
    }

    return -1;
  }
}

const MIN_TOKENS = 15;
let session = new TranscriptSession();

export function match(
  transcript: TextElement[],
  isFinal: boolean,
  text: TextElement[],
) {
  const initialTokens = [...session.recentTokens];

  // Pad extra words from previous recognitions
  if (transcript.length < MIN_TOKENS) {
    const last = session.previousTokens.slice(transcript.length - MIN_TOKENS);
    const tokens = transcript.map(
      (token, index): TextElement => ({
        ...token,
        index: session.previousTokenQuantity + index,
      }),
    );
    session.recentTokens = last.concat(tokens);
  } else {
    // Hypothesis is long enough to take all words
    const tokens = transcript.slice(-MIN_TOKENS).map(
      (token, index): TextElement => ({
        ...token,
        index:
          session.previousTokenQuantity +
          (transcript.length - MIN_TOKENS) +
          index,
      }),
    );

    session.recentTokens = tokens;
  }

  session.currentTokenQuantity = transcript.length;

  if (isFinal) {
    session.previousTokenQuantity =
      session.previousTokenQuantity + session.currentTokenQuantity;
    session.previousTokens = session.recentTokens;
  }

  const transcriptSection = session.getSection();
  if (
    session.recentTokens.length === initialTokens.length &&
    session.recentTokens.every(
      (value, index) =>
        value.value === initialTokens[index].value &&
        value.index === initialTokens[index].index,
    )
  ) {
    return;
  }

  const match = matchText(transcriptSection, text);
  if (match) {
    session.lastMatch = match.transcriptMatch;
    return match;
  }
}

export function reset() {
  session = new TranscriptSession();
}

import { type TextElement, tokenize } from "./word-tokenizer";
import { levenshteinDistance } from "./levenshtein";

// This is the "secret sauce" of this whole project: a robust algorithm to match
// the reference text and the speech recognized text using the levenshtein distance.
export const computeSpeechRecognitionTokenIndex = (
  recognized: string,
  reference: TextElement[],
  lastRecognizedTokenIndex: number,
) => {
  // Tokenize the recognized input:
  const recognized_tokens = tokenize(recognized).filter(
    (element) => element.type === "TOKEN",
  );

  // Convert the tokens back to a string:
  const comparison_string = recognized_tokens
    .reduce(
      (accumulator, currentToken) => accumulator + " " + currentToken.value,
      "",
    )
    .replace(/\s+/, " ")
    .trim();

  if (lastRecognizedTokenIndex < 0) {
    lastRecognizedTokenIndex = 0;
  }

  // Now, let's pick the next few tokens from the reference text starting at the last recognized token index.
  // To simplify, we'll pluck recognized_tokens.length * 2 + 10, and we'll filter out the delimiters:
  const reference_tokens = reference
    .slice(
      lastRecognizedTokenIndex,
      lastRecognizedTokenIndex + recognized_tokens.length * 2 + 10,
    )
    .filter((element) => element.type === "TOKEN");

  // Now, compute the levenshtein distances between the comparison string
  // and each possible substring created from the reference tokens:
  const distances: number[] = [];

  let i = 0;

  while (++i <= reference_tokens.length) {
    const reference_substring = reference_tokens
      .slice(0, i)
      .reduce(
        (accumulator, currentToken) => accumulator + " " + currentToken.value,
        "",
      )
      .replace(/\s+/, " ")
      .trim();
    distances.push(levenshteinDistance(comparison_string, reference_substring));
  }

  // Find the index of the minimum distance:
  const index = distances.indexOf(Math.min(...distances));

  // Trace that back to the token object:
  const token = reference_tokens[index];

  if (token) {
    return token.index;
  }

  return lastRecognizedTokenIndex;
};

import { matchText } from "./ngram-matcher";

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

import type { TextElement } from "./word-tokenizer";

type Match = {
  dotProduct: number;
  score: number;
  words: TextElement[];
};

type Ngram = {
  tokens: TextElement[];
  weight: number;
};

export type MatchResult = {
  transcriptMatch: TextElement[];
  textMatch: TextElement[];
};

export class Matcher {
  private NGRAM_SCORE_THRESHOLD = 3.0;
  private REGULAR_NGRAM_WEIGHT = 1.25;
  private SCORE_THRESHOLD = 3.5;
  private START_THROTTLING_FRACTION = 0.8;
  private throttlingArtifactRange: [number, number] = [0, 0];
  private throttlingIteration: number = 0;
  private fillerWords = [
    "the",
    "to",
    "by",
    "of",
    "a",
    "as",
    "you",
    "do",
    "at",
    "or",
    "an",
    "us",
  ];

  public matchText(
    speechTokens: TextElement[],
    referenceTokens: TextElement[],
  ): MatchResult | undefined {
    let firstMatch: Match;

    const hypothesisTokens = speechTokens.filter(
      (token) => !this.isFillerWord(token.value),
    );
    // No good words to match on/speech too short
    if (hypothesisTokens.length < 1) {
      return;
    }

    const wordTokens = referenceTokens.filter(
      (token) => !this.isFillerWord(token.value),
    );

    const matches = this.calculateMatches(hypothesisTokens, wordTokens);
    if (matches.length === 0) {
      return;
    }
    if (matches.length === 1) {
      firstMatch = matches[0];
      firstMatch.score = this.createNgramScore(
        firstMatch,
        this.createNgram(hypothesisTokens, 2),
        this.createNgram(hypothesisTokens, 3),
      );
    } else {
      firstMatch = this.findFirstMatch(
        matches,
        this.createNgram(hypothesisTokens, 2),
        this.createNgram(hypothesisTokens, 3),
      );
    }

    // Under dot product threshold
    if (firstMatch.dotProduct < 3) {
      return;
    }

    // Score below threshold
    if (firstMatch.score < this.NGRAM_SCORE_THRESHOLD) {
      return;
    }

    const words = firstMatch.words;

    const start =
      (words[0].start +
        (words[words.length - 1].end - words[0].start) / 2 -
        wordTokens[0].start) /
      (wordTokens[wordTokens.length - 1].end - wordTokens[0].start);

    if (
      start < this.START_THROTTLING_FRACTION ||
      this.throttlingIteration > 2 ||
      this.START_THROTTLING_FRACTION / this.throttlingIteration > 0.5
    ) {
      this.throttlingIteration = 0;
      // Matched string exists
      return {
        transcriptMatch: hypothesisTokens,
        textMatch: firstMatch.words,
      };
    }

    // Match Fraction exceeded. Starting throttling to receive more accurate hypothesis
    const intRange: [number, number] = [
      wordTokens[0].start,
      wordTokens[wordTokens.length - 1].end,
    ];
    if (
      this.throttlingArtifactRange[0] === intRange[0] &&
      this.throttlingArtifactRange[1] === intRange[1]
    ) {
      this.throttlingIteration++;
    } else {
      this.throttlingIteration = 1;
      this.throttlingArtifactRange = intRange;
    }

    return;
  }

  private findUniqueWordCounts(words: TextElement[]): [string[], number[]] {
    const map = new Map<string, number>();
    words.forEach((word) => {
      if (word.value.trim() === "") return;
      if (map.has(word.value)) {
        map.set(word.value, map.get(word.value)! + 1);
      } else {
        map.set(word.value, 1);
      }
    });

    return [[...map.keys()], [...map.values()]];
  }

  private getDotProduct(array1: number[], array2: number[]): number {
    if (array1.length !== array2.length) {
      return 0;
    }

    let d = 0;
    for (let i = 0; i < array1.length; i++) {
      d += array1[i] * array2[i];
    }

    return d;
  }

  private createNgram(words: TextElement[], size: number): Ngram[] {
    const length = words.length - size;
    const ngrams: Ngram[] = [];

    if (words.length < size || length < 0) {
      return ngrams;
    }

    let i = 0;
    while (i < length) {
      const tokens: TextElement[] = words.slice(i, i + size);
      const weight = tokens
        .map((token) =>
          this.isFillerWord(token.value) ? 0.5 : this.REGULAR_NGRAM_WEIGHT,
        )
        .reduce((a, b) => a + b, 0);

      ngrams.push({
        weight,
        tokens,
      });
      i++;
    }

    return ngrams;
  }

  private isFillerWord(word: string): boolean {
    return this.fillerWords.some(
      (filler) => filler.toUpperCase() === word.toUpperCase(),
    );
  }

  private createNgramScore(
    match: Match,
    bigrams: Ngram[],
    trigrams: Ngram[],
  ): number {
    return (
      2 * this.getNgramOverlapScore(this.createNgram(match.words, 2), bigrams) +
      3 * this.getNgramOverlapScore(this.createNgram(match.words, 3), trigrams)
    );
  }

  private getNgramOverlapScore(words1: Ngram[], words2: Ngram[]): number {
    let f = 0;

    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1.tokens.length === word2.tokens.length) {
          for (let i = 0; i < word1.tokens.length; i++) {
            if (word1.tokens[i].value !== word2.tokens[i].value) {
              break;
            }
            if (i === word1.tokens.length - 1) {
              f += word1.weight;
            }
          }
        }
      }
    }

    return f;
  }

  private findBestMatch(
    matches: Match[],
    bigrams: Ngram[],
    trigrams: Ngram[],
  ): Match {
    if (matches.length === 0) {
      throw new Error("No matches found.");
    }

    let bestMatch: Match = matches[0];
    for (const match of matches) {
      match.score = this.createNgramScore(match, bigrams, trigrams);
      if (
        match.score > bestMatch.score &&
        match.dotProduct > bestMatch.dotProduct
      ) {
        bestMatch = match;
      }
    }

    return bestMatch;
  }

  private findFirstMatch(
    matches: Match[],
    bigrams: Ngram[],
    trigrams: Ngram[],
  ): Match {
    for (const match of matches) {
      match.score = this.createNgramScore(match, bigrams, trigrams);
      if (match.score >= this.SCORE_THRESHOLD && match.dotProduct >= 2) {
        return match;
      }
    }

    return this.findBestMatch(matches, bigrams, trigrams);
  }

  // Uses Cosine Difference
  private calculateMatches(
    transcript: TextElement[],
    text: TextElement[],
  ): Match[] {
    let wordTokens: TextElement[] = [];
    const [uniqueWords, uniqueWordCounts] =
      this.findUniqueWordCounts(transcript);

    const matches: Match[] = [];

    if (transcript.length === 1) {
      const hypothesisToken = transcript[0];
      for (const wordToken of text) {
        if (hypothesisToken.value === wordToken.value) {
          matches.push({
            words: [wordToken],
            score: 0, // Isn't actually set until matches are found.
            dotProduct: 1,
          });
        }
      }
    } else {
      for (let i = 0; text.length - i > 0; i++) {
        if (transcript.length + i <= text.length) {
          wordTokens = text.slice(i, transcript.length + i);
        } else {
          if (i >= text.length - 1) {
            break;
          }
          wordTokens = text.slice(i, text.length);
        }

        const uniqueWordLookup: number[] = new Array(
          uniqueWordCounts.length,
        ).fill(0);
        for (const token of wordTokens) {
          if (uniqueWords.some((item) => item === token.value)) {
            uniqueWordLookup[uniqueWords.indexOf(token.value)] = 1;
          }
        }

        const dotProduct = this.getDotProduct(
          uniqueWordLookup,
          uniqueWordCounts,
        );
        if (dotProduct > 0) {
          matches.push({
            words: wordTokens,
            score: 0,
            dotProduct,
          });
        }
      }
    }

    return matches;
  }
}

export class TranscriptSession {
  previousTokens: TextElement[] = [];
  recentTokens: TextElement[] = [];
  currentTokenQuantity = 0;
  previousTokenQuantity = 0;
  lastMatch: TextElement[] = [];

  public getTranscriptSection(): TextElement[] {
    if (this.lastMatch.length === 0) {
      const recentMatches = this.findRecentMatches(
        this.lastMatch,
        this.recentTokens,
      );
      if (recentMatches > -1 && this.recentTokens.length - recentMatches <= 5) {
        return this.recentTokens.slice(
          recentMatches + 1,
          this.recentTokens.length,
        );
      }
    }
    return this.recentTokens.slice(-5);
  }

  private findRecentMatches(
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

export class MatchProcessor {
  session = new TranscriptSession();
  matcher = new Matcher();
  MIN_TOKENS = 15;

  public run(transcript: TextElement[], isFinal: boolean, text: TextElement[]) {
    const initialTokens = [...this.session.recentTokens];

    // Pad extra words from previous recognitions
    if (transcript.length < this.MIN_TOKENS) {
      const last = this.session.previousTokens.slice(
        transcript.length - this.MIN_TOKENS,
      );
      const tokens = transcript.map(
        (token, index): TextElement => ({
          ...token,
          index: this.session.previousTokenQuantity + index,
        }),
      );
      this.session.recentTokens = last.concat(tokens);
    } else {
      // Hypothesis is long enough to take all words
      const tokens = transcript.slice(-this.MIN_TOKENS).map(
        (token, index): TextElement => ({
          ...token,
          index:
            this.session.previousTokenQuantity +
            (transcript.length - this.MIN_TOKENS) +
            index,
        }),
      );

      this.session.recentTokens = tokens;
    }

    this.session.currentTokenQuantity = transcript.length;

    if (isFinal) {
      this.session.previousTokenQuantity =
        this.session.previousTokenQuantity + this.session.currentTokenQuantity;
      this.session.previousTokens = this.session.recentTokens;
    }

    const transcriptSection = this.session.getTranscriptSection();
    if (
      this.session.recentTokens.every(
        (value, index) =>
          value.value === initialTokens[index].value &&
          value.index === initialTokens[index].index,
      )
    ) {
      return;
    }

    const match = this.matcher.matchText(transcriptSection, text);
    if (match) {
      this.session.lastMatch = match.transcriptMatch;
      return match;
    }
  }

  public stop() {
    this.session = new TranscriptSession();
  }
}

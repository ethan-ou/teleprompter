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

type SpeechToken = {
  position: number;
  word: string;
};

type Match = {
  dotProduct: number;
  score: number;
  words: WordToken[];
};

type WordToken = {
  start: number;
  end: number;
  word: string;
};

type Ngram<T> = {
  tokens: T[];
  weight: number;
};

type MatchResult = {
  matchedSpeech: SpeechToken[];
  matchedText: WordToken[];
};

class Matcher {
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
    speechTokens: SpeechToken[],
    referenceTokens: WordToken[],
  ): MatchResult | undefined {
    let firstMatch: Match;

    const hypothesisTokens = speechTokens.filter(
      (token) => !this.isFillerWord(token.word),
    );
    // No good words to match on/speech too short
    if (hypothesisTokens.length < 1) {
      return;
    }

    const wordTokens = referenceTokens.filter(
      (token) => !this.isFillerWord(token.word),
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
      const matchResult: MatchResult = {
        matchedText: firstMatch.words,
        matchedSpeech: hypothesisTokens,
      };
      return matchResult;
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

  private createUniqueWordCountMap(words: SpeechToken[]): Map<string, number> {
    const map = new Map<string, number>();
    words.forEach((word) => {
      if (word.word.trim() === "") return;
      if (map.has(word.word)) {
        map.set(word.word, map.get(word.word)! + 1);
      } else {
        map.set(word.word, 1);
      }
    });
    return map;
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

  private createNgram<T extends { word: string }>(
    arrayOfWords: T[],
    sizeOfGram: number,
  ): Ngram<T>[] {
    const length = arrayOfWords.length - sizeOfGram;
    const arrayList: Ngram<T>[] = [];
    if (arrayOfWords.length >= sizeOfGram && length >= 0) {
      let i = 0;
      while (i < length) {
        const arrayList2: T[] = [];
        let i2 = i + sizeOfGram;
        for (let i3 = i; i3 < i2; i3++) {
          arrayList2.push(arrayOfWords[i3]);
        }
        let arrayList4: number[] = [];
        arrayList2.forEach((item) => {
          arrayList4.push(
            this.isFillerWord(item.word) ? 0.5 : this.REGULAR_NGRAM_WEIGHT,
          );
        });

        const ngram: Ngram<T> = {
          weight: arrayList4.reduce((a, b) => a + b, 0),
          tokens: arrayList2,
        };
        arrayList.push(ngram);
        i++;
      }
    }

    return arrayList;
  }

  private isFillerWord(word: string): boolean {
    return this.fillerWords.some(
      (filler) => filler.toUpperCase() === word.toUpperCase(),
    );
  }

  private createNgramScore(
    match: Match,
    bigrams: Ngram<SpeechToken>[],
    trigrams: Ngram<SpeechToken>[],
  ): number {
    return (
      2 * this.getNgramOverlapScore(this.createNgram(match.words, 2), bigrams) +
      3 * this.getNgramOverlapScore(this.createNgram(match.words, 3), trigrams)
    );
  }

  private getNgramOverlapScore<
    T extends { word: string },
    M extends { word: string },
  >(words1: Ngram<T>[], words2: Ngram<M>[]): number {
    let f = 0;

    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1.tokens.length === word2.tokens.length) {
          for (let i = 0; i < word1.tokens.length; i++) {
            if (word1.tokens[i].word !== word2.tokens[i].word) {
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
    bigrams: Ngram<SpeechToken>[],
    trigrams: Ngram<SpeechToken>[],
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
    bigrams: Ngram<SpeechToken>[],
    trigrams: Ngram<SpeechToken>[],
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
    speechTokens: SpeechToken[],
    candidateArtifact: WordToken[],
  ): Match[] {
    let wordTokens: WordToken[] = [];
    const uniqueWordCountMap = this.createUniqueWordCountMap(speechTokens);
    const uniqueWords = [...uniqueWordCountMap.keys()];
    const uniqueWordCounts = [...uniqueWordCountMap.values()];

    const matches: Match[] = [];

    if (speechTokens.length === 1) {
      // Skipping use of cosine dot product
      const hypothesisToken = speechTokens[0];
      for (const wordToken of candidateArtifact) {
        if (hypothesisToken.word === wordToken.word) {
          matches.push({
            words: [wordToken],
            score: 0, // Isn't actually set until matches are found.
            dotProduct: 1,
          });
        }
      }
    } else {
      for (let i = 0; candidateArtifact.length - i > 0; i++) {
        if (speechTokens.length + i <= candidateArtifact.length) {
          wordTokens = candidateArtifact.slice(i, speechTokens.length + i);
        } else {
          if (i >= candidateArtifact.length - 1) {
            break;
          }
          wordTokens = candidateArtifact.slice(i, candidateArtifact.length);
        }

        const uniqueWordLookup: number[] = new Array(
          uniqueWordCounts.length,
        ).fill(0);
        for (const token of wordTokens) {
          if (uniqueWords.some((item) => item === token.word)) {
            uniqueWordLookup[uniqueWords.indexOf(token.word)] = 1;
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

class TranscriptSession {
  previousTokens: SpeechToken[] = [];
  recentTokens: SpeechToken[] = [];
  currentTokenQuantity = 0;
  previousTokenQuantity = 0;
  lastMatch: SpeechToken[] = [];

  public getTranscriptSection(): SpeechToken[] {
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
    lastMatch: SpeechToken[],
    recentTokens: SpeechToken[],
  ) {
    if (lastMatch.length > 0) {
      for (let i = lastMatch.length - 1; i >= 0; i--) {
        const index = recentTokens.findIndex(
          (token) =>
            lastMatch[i].position === token.position &&
            lastMatch[i].word === token.word,
        );
        if (index > -1) return index;
      }
    }

    return -1;
  }
}

class MatchProcessor {
  session = new TranscriptSession();
  matcher = new Matcher();
  MIN_TOKENS = 15;

  public run(
    transcript: string[],
    isFinal: boolean,
    originalText: WordToken[],
  ) {
    const initialRecentTokens = [...this.session.recentTokens];

    // Pad extra words from previous recognitions
    if (transcript.length < this.MIN_TOKENS) {
      const last = this.session.previousTokens.slice(
        transcript.length - this.MIN_TOKENS,
      );
      const tokens = transcript.map(
        (token, index): SpeechToken => ({
          word: token,
          position: this.session.previousTokenQuantity + index,
        }),
      );
      this.session.recentTokens = last.concat(tokens);
    } else {
      // Hypothesis is long enough to take all words
      const tokens = transcript.slice(-this.MIN_TOKENS).map(
        (token, index): SpeechToken => ({
          word: token,
          position:
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
          value.word === initialRecentTokens[index].word &&
          value.position === initialRecentTokens[index].position,
      )
    ) {
      return;
    }

    const match = this.matcher.matchText(transcriptSection, originalText);
    if (match) {
      this.session.lastMatch = match.matchedSpeech;
      return match;
    }
  }

  public stop() {
    this.session = new TranscriptSession();
  }
}

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

const NGRAM_SCORE_THRESHOLD = 3.0;
const REGULAR_NGRAM_WEIGHT = 1.25;
const SCORE_THRESHOLD = 3.5;
const FILLER_WORDS = [
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

function isFillerWord(word: string): boolean {
  return FILLER_WORDS.some(
    (filler) => filler.toUpperCase() === word.toUpperCase(),
  );
}

const START_THROTTLING_FRACTION = 0.8;
const throttling = {
  artifactRange: [0, 0],
  iteration: 0,
};

export function matchText(
  speechTokens: TextElement[],
  referenceTokens: TextElement[],
): MatchResult | undefined {
  let firstMatch: Match;

  const hypothesisTokens = speechTokens.filter(
    (token) => !isFillerWord(token.value),
  );
  // No good words to match on/speech too short
  if (hypothesisTokens.length < 1) {
    return;
  }

  const wordTokens = referenceTokens.filter(
    (token) => !isFillerWord(token.value),
  );

  const matches = calculateMatches(hypothesisTokens, wordTokens);
  if (matches.length === 0) {
    return;
  }
  if (matches.length === 1) {
    firstMatch = matches[0];
    firstMatch.score = createNgramScore(
      firstMatch,
      createNgram(hypothesisTokens, 2),
      createNgram(hypothesisTokens, 3),
    );
  } else {
    firstMatch = findFirstMatch(
      matches,
      createNgram(hypothesisTokens, 2),
      createNgram(hypothesisTokens, 3),
    );
  }

  // Under dot product threshold
  if (firstMatch.dotProduct < 3) {
    return;
  }

  // Score below threshold
  if (firstMatch.score < NGRAM_SCORE_THRESHOLD) {
    return;
  }

  const words = firstMatch.words;
  const start =
    (words[0].start +
      (words[words.length - 1].end - words[0].start) / 2 -
      wordTokens[0].start) /
    (wordTokens[wordTokens.length - 1].end - wordTokens[0].start);

  if (
    start < START_THROTTLING_FRACTION ||
    throttling.iteration > 2 ||
    START_THROTTLING_FRACTION / throttling.iteration > 0.5
  ) {
    throttling.iteration = 0;
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
    throttling.artifactRange[0] === intRange[0] &&
    throttling.artifactRange[1] === intRange[1]
  ) {
    throttling.iteration++;
  } else {
    throttling.iteration = 1;
    throttling.artifactRange = intRange;
  }
}

function findUniqueWordCounts(words: TextElement[]): [string[], number[]] {
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

function getDotProduct(array1: number[], array2: number[]): number {
  let d = 0;
  if (array1.length !== array2.length) {
    return d;
  }

  for (let i = 0; i < array1.length; i++) {
    d += array1[i] * array2[i];
  }

  return d;
}

function createNgram(words: TextElement[], size: number): Ngram[] {
  const length = words.length - size;
  const ngrams: Ngram[] = [];

  if (words.length < size || length < 0) {
    return ngrams;
  }

  let i = 0;
  while (i < length) {
    const tokens: TextElement[] = words.slice(i, i + size);
    const weight = tokens
      .map((token) => (isFillerWord(token.value) ? 0.5 : REGULAR_NGRAM_WEIGHT))
      .reduce((a, b) => a + b, 0);

    ngrams.push({
      weight,
      tokens,
    });
    i++;
  }

  return ngrams;
}

function createNgramScore(
  match: Match,
  bigrams: Ngram[],
  trigrams: Ngram[],
): number {
  return (
    2 * getNgramOverlapScore(createNgram(match.words, 2), bigrams) +
    3 * getNgramOverlapScore(createNgram(match.words, 3), trigrams)
  );
}

function getNgramOverlapScore(words1: Ngram[], words2: Ngram[]): number {
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

function findBestMatch(
  matches: Match[],
  bigrams: Ngram[],
  trigrams: Ngram[],
): Match {
  if (matches.length === 0) {
    throw new Error("No matches found.");
  }

  let bestMatch: Match = matches[0];
  for (const match of matches) {
    match.score = createNgramScore(match, bigrams, trigrams);
    if (
      match.score > bestMatch.score &&
      match.dotProduct > bestMatch.dotProduct
    ) {
      bestMatch = match;
    }
  }

  return bestMatch;
}

function findFirstMatch(
  matches: Match[],
  bigrams: Ngram[],
  trigrams: Ngram[],
): Match {
  for (const match of matches) {
    match.score = createNgramScore(match, bigrams, trigrams);
    if (match.score >= SCORE_THRESHOLD && match.dotProduct >= 2) {
      return match;
    }
  }

  return findBestMatch(matches, bigrams, trigrams);
}

// Uses Cosine Difference
function calculateMatches(
  transcript: TextElement[],
  text: TextElement[],
): Match[] {
  let wordTokens: TextElement[] = [];
  const [uniqueWords, uniqueWordCounts] = findUniqueWordCounts(transcript);

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

      const dotProduct = getDotProduct(uniqueWordLookup, uniqueWordCounts);
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

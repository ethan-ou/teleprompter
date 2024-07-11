import { type TextElement, tokenize } from "./word-tokenizer";
import { levenshteinDistance } from "./levenshtein";
import { getAveragedPositions, resetPositions } from "./average-position";

/*
  Algorithm used to match transcript to the text is a simple
  sliding window algorithm using Levenshtein Distance to measure
  the difference in text.

  The window with the lowest score is the one that's selected. The
  selection is then smoothed by averaging with the previous selections
  to avoid rapid jumps in text position.
*/

const MIN_WINDOW = 3;
const MATCH_WINDOW = 5;
const MAX_TEXT_DISTANCE = 0.75;
const STOP_WORDS = [
  "i",
  "me",
  "my",
  "we",
  "us",
  "our",
  "you",
  "it",
  "its",
  "it's",
  "am",
  "is",
  "be",
  "do",
  "a",
  "an",
  "are",
  "the",
  "and",
  "but",
  "if",
  "or",
  "as",
  "of",
  "at",
  "by",
  "for",
  "to",
  "so",
  "you",
  "your",
  "in",
  "on",
];

export function getTokensFromText(text: string) {
  return tokenize(text).filter((element) => element.type === "TOKEN");
}

export function createTextRegion(
  tokens: TextElement[],
  index: number,
  next = 50,
  previous = 20,
) {
  return tokens
    .slice(index - previous > 0 ? index - previous : 0, index + next)
    .filter((element) => element.type === "TOKEN");
}

export function matchText(
  transcript: TextElement[],
  text: TextElement[],
  isFinal: boolean,
) {
  const transcriptSection = filterStopWords(transcript).slice(-MATCH_WINDOW);
  if (transcriptSection.length < MIN_WINDOW) {
    return;
  }

  const slices = createTextWindow(
    filterStopWords(text),
    transcriptSection.length < MATCH_WINDOW
      ? transcriptSection.length
      : MATCH_WINDOW,
  );
  const bestWindow = findBestTextWindow(transcriptSection, slices);
  if (bestWindow) {
    const averagePositions = getAveragedPositions(
      bestWindow.at(0)!.index,
      bestWindow.at(-1)!.index,
    );

    if (isFinal) {
      resetPositions();
    }

    if (averagePositions) {
      return averagePositions;
    }
  }

  if (isFinal) {
    resetPositions();
  }
}

function createTextWindow(tokens: TextElement[], length: number) {
  if (tokens.length <= length) {
    return [tokens];
  }

  const slices = [];
  let i = 0;
  while (i < tokens.length - length) {
    slices.push(tokens.slice(i, i + length));
    i++;
  }

  return slices;
}

function findBestTextWindow(
  transcript: TextElement[],
  textSlices: TextElement[][],
) {
  const transcriptText = transcript.map((text) => text.value).join("");
  const distances = textSlices.map((slice) => {
    const sliceText = slice.map((text) => text.value).join("");
    return levenshteinDistance(transcriptText, sliceText);
  });

  const lowestDistanceIndex = distances.indexOf(
    Math.min.apply(Math, distances),
  );

  /*
    When talking off script or if the transcript is too different to
    the text, avoid giving a match.

    Levenshtein Distance generally gets larger the longer the string,
    so we normalise here to give a rough estimate.
  */
  const normalisedDistance =
    distances[lowestDistanceIndex] / transcriptText.length;
  if (normalisedDistance > MAX_TEXT_DISTANCE) {
    return;
  }

  if (lowestDistanceIndex > -1) {
    return textSlices[lowestDistanceIndex];
  }
}

function filterStopWords(tokens: TextElement[]) {
  return tokens.filter(
    (token) => !STOP_WORDS.includes(token.value.toLowerCase()),
  );
}

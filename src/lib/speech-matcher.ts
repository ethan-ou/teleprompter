import { type Token, tokenize } from "./word-tokenizer";
import { levenshteinDistance } from "./levenshtein";
import { calculateMovingAverage } from "./moving-average";

/*
  Algorithm used to match transcript to the text is a simple
  sliding window algorithm using Levenshtein Distance to measure
  the difference in text.

  The window with the lowest score is the one that's selected. The
  selection is then smoothed by averaging with the previous selections
  to avoid rapid jumps in text position.
*/

const MIN_WINDOW = 3;
const MATCH_WINDOW = 6;

const TEXT_REGION_NEXT = 50;
const TEXT_REGION_PREVIOUS = 10;

export function getTokensFromText(text: string) {
  return tokenize(text).filter((element) => element.type === "TOKEN");
}

/*
  Avoid too much backtracking and too much forward prediction since it breaks the stability
  of the matching in its general usage. 
*/
export function createTextRegion(
  tokens: Token[],
  index: number,
  next = TEXT_REGION_NEXT,
  previous = TEXT_REGION_PREVIOUS,
) {
  return tokens
    .slice(index - previous > 0 ? index - previous : 0, index + next)
    .filter((element) => element.type === "TOKEN");
}

export function getBoundsStart(tokens: Token[], index: number, existingRegion?: Token[]) {
  const region = existingRegion ? existingRegion : createTextRegion(tokens, index);
  const firstBounds = region.at(-1);
  if (firstBounds) {
    return firstBounds.index + 1;
  }
}

let transcriptWindow: Token[] = [];

function getTranscriptWindow(transcript: Token[], isFinal: boolean) {
  if (isFinal) {
    transcriptWindow = transcriptWindow.concat(transcript).slice(-MATCH_WINDOW);
    return transcriptWindow;
  }

  return transcript.length < MATCH_WINDOW
    ? transcriptWindow.concat(transcript).slice(-MATCH_WINDOW)
    : transcript.slice(-MATCH_WINDOW);
}

export function resetTranscriptWindow() {
  transcriptWindow = [];
}

export function matchText(transcript: Token[], text: Token[], isFinal: boolean) {
  const transcriptWindow = getTranscriptWindow(transcript, isFinal);
  if (transcriptWindow.length < MIN_WINDOW) return;

  const textWindows = createTextWindows(text, Math.min(transcriptWindow.length, MATCH_WINDOW));

  const bestWindow = findBestTextWindow(transcriptWindow, textWindows);
  if (bestWindow) {
    return calculateMovingAverage(bestWindow.at(0)!.index, bestWindow.at(-1)!.index);
  }
}

function createTextWindows(tokens: Token[], length: number) {
  if (tokens.length <= length) {
    return [tokens];
  }

  const slices = [];
  let i = 0;
  while (i < tokens.length - length + 1) {
    slices.push(tokens.slice(i, i + length));
    i++;
  }

  return slices;
}

function findBestTextWindow(transcript: Token[], textSlices: Token[][]) {
  const transcriptText = transcript
    .map((text) => text.value)
    .join(" ")
    .toLowerCase();
  const distances = textSlices.map((slice) => {
    const sliceText = slice
      .map((text) => text.value)
      .join(" ")
      .toLowerCase();
    return levenshteinDistance(transcriptText, sliceText) / transcriptText.length;
  });

  /*
    If there's an obvious high accuracy match, pick that. Otherwise go further
    and further into lower confidence until you skip matching altogether.

    Searching from the beginning of the text gives better stability than
    trying to find a best match in the whole text section. But it does
    rely on having not too much backtracking in the text.
  */
  const lowDistanceIndex = distances.findIndex((distance) => distance <= 0.1);
  if (lowDistanceIndex > -1) {
    return textSlices[findBestIndex(distances, lowDistanceIndex)];
  }

  const midDistanceIndex = distances.findIndex((distance) => distance <= 0.3);
  if (midDistanceIndex > -1) {
    return textSlices[findBestIndex(distances, midDistanceIndex)];
  }

  const highDistanceIndex = distances.findIndex((distance) => distance <= 0.5);
  if (highDistanceIndex > -1) {
    return textSlices[highDistanceIndex];
  }
}

/* Once a good index has been found, see if there's anything better
   a little after the index. Sometimes, the best match is an index
   after the current match. */
function findBestIndex(distances: number[], index: number) {
  const MAX_SEARCH_AREA = 2;

  const selectedDistances = distances.slice(index, index + MAX_SEARCH_AREA + 1);
  const minimumIndex = selectedDistances.indexOf(Math.min.apply(Math, selectedDistances));
  return index + minimumIndex;
}
